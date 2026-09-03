import os
import re
import json
import uuid
import base64
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Literal

import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ------------------------------------------------------------------ config ---
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "rigrent-dev-secret-change-me")
JWT_ALGO = "HS256"
TOKEN_DAYS = 30
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rigrent")

# ---------------------------------------------------------------- storage ----
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "rigrent"
_storage_key = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ------------------------------------------------------------------- app -----
app = FastAPI(title="RigRent API")
api = APIRouter(prefix="/api")

Role = Literal["renter", "owner", "vendor", "admin"]


# ----------------------------------------------------------------- models ----
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Role = "renter"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class VerifyIn(BaseModel):
    doc_type: Literal["license", "insurance"]
    image_base64: str


class ListingIn(BaseModel):
    title: str
    kind: Literal["truck", "trailer"]
    category: str  # Box, Flatbed, Reefer, Semi, Dry Van, Lowboy
    location: str
    daily_rate: float
    year: Optional[int] = None
    make: Optional[str] = None
    capacity: Optional[str] = None
    description: Optional[str] = ""
    photos: List[str] = []


class BookingIn(BaseModel):
    listing_id: str
    start_date: str
    end_date: str
    days: int = Field(ge=1)
    load_type: str
    load_weight: Optional[str] = None
    pickup: str
    dropoff: str
    notes: Optional[str] = ""


class BookingStatusIn(BaseModel):
    status: Literal["approved", "declined", "active", "completed", "cancelled"]


class InspectionIn(BaseModel):
    phase: Literal["before", "after"]
    video_path: str


class RequestIn(BaseModel):
    title: str
    category: Literal["tow", "repair", "maintenance"]
    location: str
    description: Optional[str] = ""


class BidIn(BaseModel):
    price: float
    eta: str
    note: Optional[str] = ""


class AcceptBidIn(BaseModel):
    bid_id: str


class SettingsIn(BaseModel):
    commission_rate: float = Field(ge=0, le=0.5)


class ReviewIn(BaseModel):
    approved: bool
    note: Optional[str] = ""


# --------------------------------------------------------------- helpers -----
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def make_token(uid: str) -> str:
    payload = {
        "sub": uid,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["name"],
        "email": u["email"],
        "role": u["role"],
        "license_verified": u.get("license_verified", False),
        "insurance_verified": u.get("insurance_verified", False),
        "license_info": u.get("license_info"),
        "insurance_info": u.get("insurance_info"),
    }


async def get_current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if cred is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": uid, "active": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require(*roles: str):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "commission_rate": 0.15}
        await db.settings.insert_one(dict(s))
    return s


# --------------------------------------------------------- AI verification ---
async def ai_extract(doc_type: str, image_base64: str) -> dict:
    """Use GPT-5.4 vision to read a license or insurance document."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    if doc_type == "license":
        instruction = (
            "You are a document verification engine. Read this driver's license image and extract fields. "
            "Respond ONLY with strict JSON, no markdown, with keys: "
            "full_name (string), license_number (string), date_of_birth (string YYYY-MM-DD or null), "
            "expiry_date (string YYYY-MM-DD or null), license_class (string or null), state (string or null), "
            "is_readable (boolean), notes (string). "
            "If the image is not a driver license or unreadable, set is_readable=false."
        )
    else:
        instruction = (
            "You are a document verification engine. Read this vehicle insurance proof image and extract fields. "
            "Respond ONLY with strict JSON, no markdown, with keys: "
            "provider (string), policy_number (string), insured_name (string or null), "
            "expiry_date (string YYYY-MM-DD or null), coverage (string or null), "
            "is_readable (boolean), notes (string). "
            "If the image is not an insurance document or unreadable, set is_readable=false."
        )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"verify-{uuid.uuid4()}",
        system_message="You extract structured data from identity and insurance documents and return strict JSON only.",
    ).with_model("openai", "gpt-5.4")

    msg = UserMessage(text=instruction, file_contents=[ImageContent(image_base64=image_base64)])
    raw = await chat.send_message(msg)

    text = raw if isinstance(raw, str) else str(raw)
    text = text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    data = json.loads(text)
    return data


def compute_expired(expiry_date: Optional[str]) -> Optional[bool]:
    if not expiry_date:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            dt = datetime.strptime(expiry_date, fmt)
            return dt.date() < datetime.now(timezone.utc).date()
        except ValueError:
            continue
    return None


# =============================================================== AUTH =========
@api.get("/")
async def root():
    return {"message": "RigRent API", "status": "ok"}


@api.post("/auth/register")
async def register(data: RegisterIn):
    email = data.email.lower().strip()
    exists = await db.users.find_one({"email": email})
    if exists:
        raise HTTPException(status_code=409, detail="Account with this email already exists")
    role = data.role if data.role != "admin" else "renter"
    user = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "email": email,
        "password_hash": pwd_context.hash(data.password),
        "role": role,
        "active": True,
        "license_verified": False,
        "insurance_verified": False,
        "license_info": None,
        "insurance_info": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email, "active": True})
    dummy = "$2b$12$" + "x" * 53
    valid = pwd_context.verify(data.password, user["password_hash"] if user else dummy)
    if not user or not valid:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# =========================================================== VERIFICATION =====
@api.post("/verify/document")
async def verify_document(data: VerifyIn, user: dict = Depends(get_current_user)):
    try:
        raw = base64.b64decode(data.image_base64)
        path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.jpg"
        await run_in_threadpool(put_object, path, raw, "image/jpeg")
    except Exception as e:
        logger.error(f"storage upload failed: {e}")
        path = None

    try:
        extracted = await ai_extract(data.doc_type, data.image_base64)
    except Exception as e:
        logger.error(f"AI extract failed: {e}")
        raise HTTPException(status_code=502, detail="Could not read the document. Please retake a clear photo.")

    readable = bool(extracted.get("is_readable", False))
    expiry = extracted.get("expiry_date")
    expired = compute_expired(expiry)

    if data.doc_type == "license":
        passed = readable and expired is False
        status = "verified" if passed else ("expired" if expired else "rejected")
    else:
        passed = readable and expired is False
        status = "verified" if passed else ("expired" if expired else "rejected")

    record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "doc_type": data.doc_type,
        "storage_path": path,
        "extracted": extracted,
        "expired": expired,
        "status": status,
        "auto_passed": passed,
        "admin_reviewed": False,
        "created_at": now_iso(),
    }
    await db.verifications.insert_one(dict(record))

    info = {**extracted, "expired": expired, "status": status}
    if data.doc_type == "license":
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"license_verified": passed, "license_info": info}},
        )
    else:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"insurance_verified": passed, "insurance_info": info}},
        )

    return {
        "passed": passed,
        "status": status,
        "expired": expired,
        "extracted": extracted,
    }


@api.get("/verify/status")
async def verify_status(user: dict = Depends(get_current_user)):
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "license_verified": fresh.get("license_verified", False),
        "insurance_verified": fresh.get("insurance_verified", False),
        "license_info": fresh.get("license_info"),
        "insurance_info": fresh.get("insurance_info"),
    }


# ================================================================ UPLOAD ======
@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    ext = (file.filename or "file").split(".")[-1].lower()
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    ctype = file.content_type or "application/octet-stream"
    try:
        await run_in_threadpool(put_object, path, content, ctype)
    except Exception as e:
        logger.error(f"upload failed: {e}")
        raise HTTPException(status_code=502, detail="Upload failed")
    await db.uploads.insert_one({"id": str(uuid.uuid4()), "path": path, "owner_id": user["id"], "created_at": now_iso()})
    return {"path": path}


@api.get("/files/{path:path}")
async def files(path: str, token: Optional[str] = Query(None)):
    rec = await db.uploads.find_one({"path": path})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception as e:
        logger.error(f"download failed: {e}")
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=content, media_type=ctype)


# =============================================================== LISTINGS =====
@api.post("/listings")
async def create_listing(data: ListingIn, user: dict = Depends(require("owner", "admin"))):
    listing = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "owner_name": user["name"],
        **data.dict(),
        "active": True,
        "deleted_at": None,
        "created_at": now_iso(),
    }
    await db.listings.insert_one(dict(listing))
    listing.pop("_id", None)
    return listing


@api.get("/listings")
async def list_listings(category: Optional[str] = None, q: Optional[str] = None, kind: Optional[str] = None):
    query = {"active": True, "deleted_at": None}
    if category and category != "All":
        query["category"] = category
    if kind:
        query["kind"] = kind
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    items = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/listings/mine")
async def my_listings(user: dict = Depends(require("owner", "admin"))):
    items = await db.listings.find({"owner_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/listings/{lid}")
async def get_listing(lid: str):
    item = await db.listings.find_one({"id": lid, "deleted_at": None}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Listing not found")
    return item


@api.delete("/listings/{lid}")
async def delete_listing(lid: str, user: dict = Depends(require("owner", "admin"))):
    item = await db.listings.find_one({"id": lid})
    if not item or item["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Listing not found")
    await db.listings.update_one({"id": lid}, {"$set": {"deleted_at": now_iso(), "active": False}})
    return {"ok": True}


# =============================================================== BOOKINGS =====
@api.post("/bookings")
async def create_booking(data: BookingIn, user: dict = Depends(get_current_user)):
    if not user.get("license_verified"):
        raise HTTPException(status_code=403, detail="Driver license must be verified before booking")
    listing = await db.listings.find_one({"id": data.listing_id, "deleted_at": None}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    settings = await get_settings()
    rate = settings["commission_rate"]
    subtotal = round(listing["daily_rate"] * data.days, 2)
    app_cut = round(subtotal * rate, 2)
    owner_earnings = round(subtotal - app_cut, 2)

    booking = {
        "id": str(uuid.uuid4()),
        "listing_id": listing["id"],
        "listing_title": listing["title"],
        "listing_photo": listing["photos"][0] if listing.get("photos") else None,
        "owner_id": listing["owner_id"],
        "renter_id": user["id"],
        "renter_name": user["name"],
        **data.dict(),
        "subtotal": subtotal,
        "commission_rate": rate,
        "app_cut": app_cut,
        "owner_earnings": owner_earnings,
        "status": "pending",
        "inspections": [],
        "created_at": now_iso(),
    }
    await db.bookings.insert_one(dict(booking))
    booking.pop("_id", None)
    return booking


@api.get("/bookings/mine")
async def my_bookings(user: dict = Depends(get_current_user)):
    items = await db.bookings.find({"renter_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/bookings/incoming")
async def incoming_bookings(user: dict = Depends(require("owner", "admin"))):
    items = await db.bookings.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/bookings/{bid}")
async def get_booking(bid: str, user: dict = Depends(get_current_user)):
    item = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not item or user["id"] not in (item["owner_id"], item["renter_id"]):
        raise HTTPException(status_code=404, detail="Booking not found")
    return item


@api.post("/bookings/{bid}/status")
async def set_booking_status(bid: str, data: BookingStatusIn, user: dict = Depends(get_current_user)):
    item = await db.bookings.find_one({"id": bid})
    if not item:
        raise HTTPException(status_code=404, detail="Booking not found")
    if data.status in ("approved", "declined") and user["id"] != item["owner_id"]:
        raise HTTPException(status_code=403, detail="Only the owner can approve or decline")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": data.status}})
    return {"ok": True, "status": data.status}


@api.post("/bookings/{bid}/inspection")
async def add_inspection(bid: str, data: InspectionIn, user: dict = Depends(get_current_user)):
    item = await db.bookings.find_one({"id": bid})
    if not item or user["id"] not in (item["owner_id"], item["renter_id"]):
        raise HTTPException(status_code=404, detail="Booking not found")
    entry = {"phase": data.phase, "video_path": data.video_path, "by": user["id"], "at": now_iso()}
    await db.bookings.update_one({"id": bid}, {"$push": {"inspections": entry}})
    return {"ok": True, "inspection": entry}


# =============================================================== SETTINGS =====
@api.get("/settings")
async def settings_get():
    s = await get_settings()
    return {"commission_rate": s["commission_rate"]}


@api.post("/settings")
async def settings_set(data: SettingsIn, user: dict = Depends(require("admin"))):
    await db.settings.update_one({"id": "global"}, {"$set": {"commission_rate": data.commission_rate}}, upsert=True)
    return {"commission_rate": data.commission_rate}


# ========================================================= ROADSIDE / BIDS ====
@api.post("/requests")
async def create_request(data: RequestIn, user: dict = Depends(get_current_user)):
    req = {
        "id": str(uuid.uuid4()),
        "poster_id": user["id"],
        "poster_name": user["name"],
        **data.dict(),
        "status": "open",
        "accepted_bid_id": None,
        "created_at": now_iso(),
    }
    await db.requests.insert_one(dict(req))
    req.pop("_id", None)
    return req


@api.get("/requests")
async def list_requests(user: dict = Depends(get_current_user)):
    # vendors see all open requests; others see their own posted requests
    if user["role"] in ("vendor", "admin"):
        items = await db.requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    else:
        items = await db.requests.find({"poster_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for it in items:
        it["bid_count"] = await db.bids.count_documents({"request_id": it["id"]})
    return items


@api.get("/requests/{rid}")
async def get_request(rid: str, user: dict = Depends(get_current_user)):
    req = await db.requests.find_one({"id": rid}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    bids = await db.bids.find({"request_id": rid}, {"_id": 0}).sort("price", 1).to_list(200)
    req["bids"] = bids
    return req


@api.post("/requests/{rid}/bids")
async def create_bid(rid: str, data: BidIn, user: dict = Depends(require("vendor", "admin"))):
    req = await db.requests.find_one({"id": rid})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "open":
        raise HTTPException(status_code=400, detail="This request is no longer open")
    bid = {
        "id": str(uuid.uuid4()),
        "request_id": rid,
        "vendor_id": user["id"],
        "vendor_name": user["name"],
        **data.dict(),
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.bids.insert_one(dict(bid))
    bid.pop("_id", None)
    return bid


@api.post("/requests/{rid}/accept")
async def accept_bid(rid: str, data: AcceptBidIn, user: dict = Depends(get_current_user)):
    req = await db.requests.find_one({"id": rid})
    if not req or req["poster_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Request not found")
    bid = await db.bids.find_one({"id": data.bid_id, "request_id": rid})
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    await db.requests.update_one({"id": rid}, {"$set": {"status": "awarded", "accepted_bid_id": data.bid_id}})
    await db.bids.update_one({"id": data.bid_id}, {"$set": {"status": "accepted"}})
    await db.bids.update_many({"request_id": rid, "id": {"$ne": data.bid_id}}, {"$set": {"status": "rejected"}})
    return {"ok": True}


# ================================================================= ADMIN ======
@api.get("/admin/verifications")
async def admin_verifications(user: dict = Depends(require("admin"))):
    items = await db.verifications.find({}, {"_id": 0, "extracted": 1, "id": 1, "user_id": 1, "doc_type": 1, "status": 1, "expired": 1, "storage_path": 1, "admin_reviewed": 1, "created_at": 1}).sort("created_at", -1).to_list(200)
    return items


@api.post("/admin/verifications/{vid}/review")
async def review_verification(vid: str, data: ReviewIn, user: dict = Depends(require("admin"))):
    rec = await db.verifications.find_one({"id": vid})
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    new_status = "verified" if data.approved else "rejected"
    await db.verifications.update_one({"id": vid}, {"$set": {"status": new_status, "admin_reviewed": True, "admin_note": data.note}})
    field = "license_verified" if rec["doc_type"] == "license" else "insurance_verified"
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {field: data.approved}})
    return {"ok": True, "status": new_status}


# ================================================================= SEED ========
async def seed():
    await db.users.create_index("email", unique=True)
    await get_settings()

    async def ensure_user(name, email, password, role):
        u = await db.users.find_one({"email": email})
        if u:
            return u
        doc = {
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email,
            "password_hash": pwd_context.hash(password),
            "role": role,
            "active": True,
            "license_verified": role in ("owner", "vendor"),
            "insurance_verified": role in ("owner", "vendor"),
            "license_info": None,
            "insurance_info": None,
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(doc))
        return doc

    await ensure_user("RigRent Admin", "admin@rigrent.com", "Admin12345!", "admin")
    owner = await ensure_user("Titan Fleet Co.", "owner@rigrent.com", "Owner12345!", "owner")
    await ensure_user("John Trucker", "renter@rigrent.com", "Renter12345!", "renter")
    await ensure_user("RoadHelp Towing", "vendor@rigrent.com", "Vendor12345!", "vendor")

    if await db.listings.count_documents({}) == 0:
        demo = [
            {
                "title": "Freightliner Cascadia Sleeper",
                "kind": "truck", "category": "Semi", "location": "Dallas, TX",
                "daily_rate": 320, "year": 2022, "make": "Freightliner", "capacity": "80,000 lb GVWR",
                "description": "Long-haul sleeper cab, APU equipped, fresh service. Ready for OTR.",
                "photos": ["https://images.unsplash.com/photo-1778103617525-76877c583fa5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
            {
                "title": "48ft Reefer Trailer",
                "kind": "trailer", "category": "Reefer", "location": "Atlanta, GA",
                "daily_rate": 145, "year": 2021, "make": "Utility", "capacity": "44,000 lb",
                "description": "Carrier reefer unit, continuous run, temp logging. Perfect for cold chain loads.",
                "photos": ["https://images.unsplash.com/photo-1778103617525-76877c583fa5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
            {
                "title": "53ft Flatbed Trailer",
                "kind": "trailer", "category": "Flatbed", "location": "Phoenix, AZ",
                "daily_rate": 110, "year": 2020, "make": "Fontaine", "capacity": "48,000 lb",
                "description": "Aluminum flatbed with straps, chains and tarps included. Steel/lumber ready.",
                "photos": ["https://images.unsplash.com/photo-1740774017942-23f80f6477c5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
            {
                "title": "Box Truck 26ft w/ Liftgate",
                "kind": "truck", "category": "Box", "location": "Chicago, IL",
                "daily_rate": 180, "year": 2023, "make": "Isuzu", "capacity": "12,000 lb",
                "description": "Non-CDL box truck, liftgate, e-track. Great for last mile and moves.",
                "photos": ["https://images.unsplash.com/photo-1778103617525-76877c583fa5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
        ]
        for d in demo:
            await db.listings.insert_one({
                "id": str(uuid.uuid4()),
                "owner_id": owner["id"],
                "owner_name": owner["name"],
                **d,
                "active": True,
                "deleted_at": None,
                "created_at": now_iso(),
            })
    logger.info("seed complete")


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
    except Exception as e:
        logger.error(f"seed failed: {e}")
    if EMERGENT_LLM_KEY:
        try:
            await run_in_threadpool(init_storage)
        except Exception as e:
            logger.error(f"storage init failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
