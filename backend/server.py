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
import stripe
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Request
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
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
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://truckxchange-frontend.vercel.app")
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rigrent")

# ---------------------------------------------------------------- storage ----
# Files are stored directly in MongoDB via GridFS, so no separate storage
# service or credentials are needed beyond MONGO_URL.
APP_NAME = "rigrent"
fs_bucket = AsyncIOMotorGridFSBucket(db)


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    await fs_bucket.upload_from_stream(path, data, metadata={"content_type": content_type})
    return {"path": path}


async def get_object(path: str):
    cursor = fs_bucket.find({"filename": path}).sort("uploadDate", -1).limit(1)
    docs = await cursor.to_list(length=1)
    if not docs:
        raise FileNotFoundError(path)
    stream = await fs_bucket.open_download_stream(docs[0]["_id"])
    content = await stream.read()
    content_type = (docs[0].get("metadata") or {}).get("content_type", "application/octet-stream")
    return content, content_type


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
    category: str  # Semi, Box, Flatbed Truck, Dump Truck (trucks) | Flatbed, Reefer, Dry Van, Lowboy (trailers)
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Exact pickup logistics. Kept separate from the public "location" (city/state)
    # shown on browse cards — these are only revealed to a renter once their
    # booking is approved, so a random browser can't see an owner's exact address.
    pickup_address: Optional[str] = ""
    pickup_instructions: Optional[str] = ""
    access_code: Optional[str] = ""
    price_per_mile: float = Field(gt=0)
    daily_rate: Optional[float] = 0
    year: Optional[int] = None
    make: Optional[str] = None
    capacity: Optional[str] = None
    description: Optional[str] = ""
    photos: List[str] = []
    # Compliance / safety (required so no rig runs out of compliance)
    dot_number: str
    mc_number: Optional[str] = ""
    vin: Optional[str] = ""
    plate: Optional[str] = ""
    insurance_provider: str
    insurance_policy: str
    insurance_expiry: str  # YYYY-MM-DD


class BookingIn(BaseModel):
    listing_id: str
    estimated_miles: int = Field(ge=1)
    start_date: Optional[str] = "TBD"
    end_date: Optional[str] = "TBD"
    load_type: str
    load_weight: Optional[str] = None
    pickup: str
    dropoff: str
    return_same_location: bool = True
    return_location_note: Optional[str] = ""
    notes: Optional[str] = ""


class BookingStatusIn(BaseModel):
    status: Literal["approved", "declined", "active", "completed", "cancelled"]


class BookingReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = ""


class InspectionIn(BaseModel):
    phase: Literal["before", "after"]
    video_path: str
    odometer: Optional[int] = None
    fuel_level: Optional[Literal["full", "3/4", "1/2", "1/4", "empty"]] = None


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


class MessageIn(BaseModel):
    context_type: Literal["booking", "request"]
    context_id: str
    body: str = Field(min_length=1, max_length=2000)


class PushTokenIn(BaseModel):
    token: str


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


def _send_expo_push(tokens: list, title: str, body: str, data: dict):
    """Blocking call to Expo's push service. Run inside a threadpool."""
    if not tokens:
        return
    messages = [{"to": t, "title": title, "body": body, "data": data or {}, "sound": "default"} for t in tokens]
    try:
        requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=15,
        )
    except Exception as e:
        logger.error(f"expo push send failed: {e}")


async def notify(user_id: str, title: str, body: str, ntype: str, data: Optional[dict] = None):
    """Create an in-app notification, and also push it to the user's phone
    if they've registered a device (via POST /push/register)."""
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "type": ntype,
        "data": data or {},
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(dict(doc))

    recipient = await db.users.find_one({"id": user_id}, {"_id": 0, "push_tokens": 1})
    tokens = (recipient or {}).get("push_tokens") or []
    if tokens:
        await run_in_threadpool(_send_expo_push, tokens, title, body, data or {})


# --------------------------------------------------------- AI verification ---
def _call_claude_vision(system_message: str, instruction: str, image_base64: str) -> str:
    """Blocking call to Claude's vision API. Run this inside a threadpool."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-5",
            "max_tokens": 1024,
            "system": system_message,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64},
                        },
                        {"type": "text", "text": instruction},
                    ],
                }
            ],
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")


async def ai_extract(doc_type: str, image_base64: str) -> dict:
    """Use Claude vision to read a license or insurance document."""
    system_message = "You extract structured data from identity and insurance documents and return strict JSON only."

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

    raw = await run_in_threadpool(_call_claude_vision, system_message, instruction, image_base64)

    text = raw.strip()
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
        await put_object(path, raw, "image/jpeg")
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
        await put_object(path, content, ctype)
    except Exception as e:
        logger.error(f"upload failed: {e}")
        raise HTTPException(status_code=502, detail="Upload failed")
    await db.uploads.insert_one({"id": str(uuid.uuid4()), "path": path, "owner_id": user["id"], "created_at": now_iso()})
    return {"path": path}


@api.get("/vin/{vin}")
async def decode_vin(vin: str):
    """Look up year/make/model from a VIN using NHTSA's free public vPIC API."""
    vin = vin.strip().upper()
    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="VIN must be 17 characters")

    def _fetch():
        resp = requests.get(
            f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{vin}",
            params={"format": "json"},
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json()

    try:
        data = await run_in_threadpool(_fetch)
    except Exception as e:
        logger.error(f"VIN decode failed: {e}")
        raise HTTPException(status_code=502, detail="Could not reach VIN decoder. Try again or enter details manually.")

    results = data.get("Results") or []
    row = results[0] if results else {}
    return {
        "vin": vin,
        "year": row.get("ModelYear") or "",
        "make": row.get("Make") or "",
        "model": row.get("Model") or "",
        "body_class": row.get("BodyClass") or "",
        "vehicle_type": row.get("VehicleType") or "",
        "gvwr": row.get("GVWR") or "",
        "error_text": row.get("ErrorText") or "",
    }


@api.get("/files/{path:path}")
async def files(path: str, token: Optional[str] = Query(None)):
    rec = await db.uploads.find_one({"path": path})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content, ctype = await get_object(path)
    except Exception as e:
        logger.error(f"download failed: {e}")
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=content, media_type=ctype)


# =============================================================== LISTINGS =====
@api.post("/listings")
async def create_listing(data: ListingIn, user: dict = Depends(require("owner", "admin"))):
    if not data.dot_number.strip() or not data.insurance_provider.strip() or not data.insurance_policy.strip() or not data.insurance_expiry.strip():
        raise HTTPException(status_code=400, detail="DOT number and insurance details are required for compliance.")
    if compute_expired(data.insurance_expiry) is True:
        raise HTTPException(status_code=400, detail="Insurance is expired. Update your policy before listing this rig.")
    listing = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "owner_name": user["name"],
        **data.dict(),
        "rating": 0,
        "rating_count": 0,
        "active": True,
        "deleted_at": None,
        "created_at": now_iso(),
    }
    # GeoJSON point for $geoNear "near me" search, alongside the plain lat/lng.
    if data.latitude is not None and data.longitude is not None:
        listing["geo"] = {"type": "Point", "coordinates": [data.longitude, data.latitude]}
    await db.listings.insert_one(dict(listing))
    listing.pop("_id", None)
    return listing


@api.get("/listings")
async def list_listings(
    category: Optional[str] = None,
    q: Optional[str] = None,
    kind: Optional[str] = None,
    sort: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_mi: Optional[float] = None,
):
    query = {"active": True, "deleted_at": None}
    if category and category != "All":
        query["category"] = category
    if kind:
        query["kind"] = kind
    if q:
        query["title"] = {"$regex": q, "$options": "i"}

    # "Near me" search: sort by real distance from the renter's device location.
    if lat is not None and lng is not None:
        geo_query = dict(query)
        geo_query["geo"] = {"$exists": True}
        pipeline = [
            {
                "$geoNear": {
                    "near": {"type": "Point", "coordinates": [lng, lat]},
                    "distanceField": "distance_meters",
                    "spherical": True,
                    "query": geo_query,
                    **({"maxDistance": radius_mi * 1609.34} if radius_mi else {}),
                }
            },
            {"$project": {"_id": 0, "pickup_address": 0, "pickup_instructions": 0, "access_code": 0}},
            {"$limit": 200},
        ]
        items = await db.listings.aggregate(pipeline).to_list(200)
        for it in items:
            it["distance_mi"] = round(it.pop("distance_meters", 0) / 1609.34, 1)
        return items

    sort_field, sort_dir = "created_at", -1
    if sort == "price_low":
        sort_field, sort_dir = "price_per_mile", 1
    elif sort == "price_high":
        sort_field, sort_dir = "price_per_mile", -1
    elif sort == "rating":
        sort_field, sort_dir = "rating", -1

    items = await db.listings.find(
        query, {"_id": 0, "pickup_address": 0, "pickup_instructions": 0, "access_code": 0}
    ).sort(sort_field, sort_dir).to_list(200)
    return items


@api.get("/listings/mine")
async def my_listings(user: dict = Depends(require("owner", "admin"))):
    items = await db.listings.find({"owner_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/listings/{lid}/availability")
async def listing_availability(lid: str):
    """Booked date ranges for this listing, so the frontend can grey out a calendar."""
    cursor = db.bookings.find(
        {"listing_id": lid, "status": {"$in": ["pending", "approved", "active"]}, "start_date": {"$ne": "TBD"}, "end_date": {"$ne": "TBD"}},
        {"_id": 0, "start_date": 1, "end_date": 1, "status": 1},
    )
    return {"booked_ranges": await cursor.to_list(length=200)}


@api.get("/listings/{lid}")
async def get_listing(lid: str):
    item = await db.listings.find_one(
        {"id": lid, "deleted_at": None},
        {"_id": 0, "pickup_address": 0, "pickup_instructions": 0, "access_code": 0},
    )
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

    # Prevent double-booking: reject if this listing already has a
    # pending/approved/active booking whose dates overlap the requested range.
    if data.start_date != "TBD" and data.end_date != "TBD":
        conflict = await db.bookings.find_one({
            "listing_id": data.listing_id,
            "status": {"$in": ["pending", "approved", "active"]},
            "start_date": {"$ne": "TBD", "$lt": data.end_date},
            "end_date": {"$ne": "TBD", "$gt": data.start_date},
        })
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"This rig is already booked {conflict['start_date']} to {conflict['end_date']}. Pick different dates.",
            )

    settings = await get_settings()
    rate = settings["commission_rate"]
    ppm = listing.get("price_per_mile") or 0
    subtotal = round(ppm * data.estimated_miles, 2)
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
        "price_per_mile": ppm,
        "subtotal": subtotal,
        "commission_rate": rate,
        "app_cut": app_cut,
        "owner_earnings": owner_earnings,
        "status": "pending",
        "reviewed": False,
        "inspections": [],
        "created_at": now_iso(),
    }
    await db.bookings.insert_one(dict(booking))
    booking.pop("_id", None)
    await notify(
        listing["owner_id"],
        "New booking request",
        f"{user['name']} wants to book {listing['title']} (~{data.estimated_miles:,} mi).",
        "booking_requested",
        {"booking_id": booking["id"]},
    )
    return booking


def strip_fee(b: dict) -> dict:
    """Renters never see the platform cut — only the total they pay."""
    b.pop("app_cut", None)
    b.pop("commission_rate", None)
    b.pop("owner_earnings", None)
    return b


@api.get("/bookings/mine")
async def my_bookings(user: dict = Depends(get_current_user)):
    items = await db.bookings.find({"renter_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [strip_fee(b) for b in items]


@api.get("/bookings/incoming")
async def incoming_bookings(user: dict = Depends(require("owner", "admin"))):
    items = await db.bookings.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/bookings/{bid}")
async def get_booking(bid: str, user: dict = Depends(get_current_user)):
    item = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not item or user["id"] not in (item["owner_id"], item["renter_id"]):
        raise HTTPException(status_code=404, detail="Booking not found")
    if user["id"] == item["renter_id"] and user["role"] != "admin":
        item = strip_fee(item)

    # Exact pickup address/instructions/access code are only revealed once the
    # owner has approved the booking — not while it's still just pending.
    if item.get("status") in ("approved", "active", "completed"):
        listing = await db.listings.find_one(
            {"id": item["listing_id"]},
            {"_id": 0, "pickup_address": 1, "pickup_instructions": 1, "access_code": 1},
        )
        if listing:
            item["pickup_address"] = listing.get("pickup_address") or ""
            item["pickup_instructions"] = listing.get("pickup_instructions") or ""
            item["access_code"] = listing.get("access_code") or ""

    return item


@api.post("/bookings/{bid}/status")
async def set_booking_status(bid: str, data: BookingStatusIn, user: dict = Depends(get_current_user)):
    item = await db.bookings.find_one({"id": bid})
    if not item:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user["id"] not in (item["owner_id"], item["renter_id"]):
        raise HTTPException(status_code=403, detail="Not your booking")

    current = item["status"]
    target = data.status

    # A booking can only move forward through a defined sequence, and only the
    # right party can trigger each step — otherwise either side could jump
    # straight from "pending" to "completed" with a raw API call.
    ALLOWED = {
        "pending": {"approved": "owner", "declined": "owner", "cancelled": "either"},
        "approved": {"active": "owner", "cancelled": "either"},
        "active": {"completed": "owner", "cancelled": "either"},
    }
    rule = ALLOWED.get(current, {})
    who = rule.get(target)
    if who is None:
        raise HTTPException(status_code=400, detail=f"Can't move a {current} booking to {target}")
    if who == "owner" and user["id"] != item["owner_id"]:
        raise HTTPException(status_code=403, detail="Only the owner can do that")

    if target == "completed":
        has_after_inspection = any(i.get("phase") == "after" for i in item.get("inspections", []))
        if not has_after_inspection:
            raise HTTPException(status_code=400, detail="Log a return (after) inspection before marking this trip completed.")

    await db.bookings.update_one({"id": bid}, {"$set": {"status": target}})
    title = item["listing_title"]
    if target == "approved":
        await notify(item["renter_id"], "Booking approved", f"Your booking for {title} was approved. Get ready to roll!", "booking_approved", {"booking_id": bid})
    elif target == "declined":
        await notify(item["renter_id"], "Booking declined", f"Your booking for {title} was declined.", "booking_declined", {"booking_id": bid})
    elif target == "active":
        await notify(item["owner_id"], "Rig picked up", f"{item['renter_name']} picked up {title}. The trip has started.", "trip_started", {"booking_id": bid})
    elif target == "completed":
        await notify(item["renter_id"], "Trip completed", f"Your trip with {title} is complete. Safe travels!", "trip_completed", {"booking_id": bid})
    elif target == "cancelled":
        other = item["renter_id"] if user["id"] == item["owner_id"] else item["owner_id"]
        await notify(other, "Booking cancelled", f"The booking for {title} was cancelled.", "booking_cancelled", {"booking_id": bid})
    return {"ok": True, "status": target}


@api.post("/bookings/{bid}/inspection")
async def add_inspection(bid: str, data: InspectionIn, user: dict = Depends(get_current_user)):
    item = await db.bookings.find_one({"id": bid})
    if not item or user["id"] not in (item["owner_id"], item["renter_id"]):
        raise HTTPException(status_code=404, detail="Booking not found")
    entry = {
        "phase": data.phase,
        "video_path": data.video_path,
        "odometer": data.odometer,
        "fuel_level": data.fuel_level,
        "by": user["id"],
        "at": now_iso(),
    }
    await db.bookings.update_one({"id": bid}, {"$push": {"inspections": entry}})

    # Once both a "before" and "after" inspection exist with odometer readings,
    # compute actual miles driven and flag if it exceeded the booking estimate.
    fresh = await db.bookings.find_one({"id": bid}, {"_id": 0})
    inspections = fresh.get("inspections", [])
    before = next((i for i in inspections if i["phase"] == "before" and i.get("odometer") is not None), None)
    after = next((i for i in inspections if i["phase"] == "after" and i.get("odometer") is not None), None)
    if before and after:
        miles_driven = after["odometer"] - before["odometer"]
        overage = max(0, miles_driven - fresh.get("estimated_miles", 0))
        await db.bookings.update_one({"id": bid}, {"$set": {"miles_driven": miles_driven, "mileage_overage": overage}})
        if overage > 0:
            await notify(
                fresh["owner_id"],
                "Mileage overage",
                f"{fresh['listing_title']} was driven {overage} mi over the estimate.",
                "mileage_overage",
                {"booking_id": bid},
            )

    return {"ok": True, "inspection": entry}


@api.post("/bookings/{bid}/review")
async def review_booking(bid: str, data: BookingReviewIn, user: dict = Depends(get_current_user)):
    item = await db.bookings.find_one({"id": bid})
    if not item or item["renter_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    if item["status"] != "completed":
        raise HTTPException(status_code=400, detail="You can leave a review once the trip is completed")
    if item.get("reviewed"):
        raise HTTPException(status_code=400, detail="You already reviewed this trip")
    review = {
        "id": str(uuid.uuid4()),
        "listing_id": item["listing_id"],
        "booking_id": bid,
        "renter_id": user["id"],
        "renter_name": user["name"],
        "rating": data.rating,
        "comment": data.comment,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(dict(review))
    await db.bookings.update_one({"id": bid}, {"$set": {"reviewed": True}})

    listing = await db.listings.find_one({"id": item["listing_id"]})
    if listing:
        old_count = listing.get("rating_count", 0)
        old_avg = listing.get("rating", 0)
        new_count = old_count + 1
        new_avg = round((old_avg * old_count + data.rating) / new_count, 2)
        await db.listings.update_one({"id": item["listing_id"]}, {"$set": {"rating": new_avg, "rating_count": new_count}})
        await notify(
            listing["owner_id"],
            "New review",
            f"{user['name']} rated {listing['title']} {data.rating}/5.",
            "review_received",
            {"listing_id": listing["id"]},
        )
    review.pop("_id", None)
    return review


@api.get("/listings/{lid}/reviews")
async def listing_reviews(lid: str):
    items = await db.reviews.find({"listing_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


# =============================================================== SETTINGS =====
@api.post("/stripe/connect")
async def stripe_connect_onboard(user: dict = Depends(require("owner", "vendor", "admin"))):
    """Owners/vendors connect a Stripe Standard account to receive payouts."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments are not configured yet. Ask the admin to add STRIPE_SECRET_KEY.")

    def _create():
        acct_id = user.get("stripe_account_id")
        if not acct_id:
            acct = stripe.Account.create(type="standard", email=user.get("email"))
            acct_id = acct.id
        link = stripe.AccountLink.create(
            account=acct_id,
            refresh_url=f"{FRONTEND_URL}/profile",
            return_url=f"{FRONTEND_URL}/profile",
            type="account_onboarding",
        )
        return acct_id, link.url

    try:
        acct_id, url = await run_in_threadpool(_create)
    except Exception as e:
        logger.error(f"stripe connect failed: {e}")
        raise HTTPException(status_code=502, detail="Could not start Stripe onboarding")
    await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_account_id": acct_id}})
    return {"onboarding_url": url}


@api.get("/stripe/status")
async def stripe_status(user: dict = Depends(get_current_user)):
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    acct_id = fresh.get("stripe_account_id") if fresh else None
    if not acct_id or not STRIPE_SECRET_KEY:
        return {"connected": False, "charges_enabled": False}

    def _fetch():
        return stripe.Account.retrieve(acct_id)

    try:
        acct = await run_in_threadpool(_fetch)
    except Exception as e:
        logger.error(f"stripe status failed: {e}")
        return {"connected": True, "charges_enabled": False}
    return {"connected": True, "charges_enabled": bool(acct.get("charges_enabled"))}


@api.post("/bookings/{bid}/pay")
async def pay_booking(bid: str, user: dict = Depends(get_current_user)):
    """Renter pays for an owner-approved booking via Stripe Checkout. The
    platform's commission is deducted automatically as a Connect application fee."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments are not configured yet")
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking or booking["renter_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] != "approved":
        raise HTTPException(status_code=400, detail="Booking must be approved by the owner before payment")

    owner = await db.users.find_one({"id": booking["owner_id"]}, {"_id": 0})
    owner_acct = owner.get("stripe_account_id") if owner else None
    if not owner_acct:
        raise HTTPException(status_code=400, detail="Owner hasn't connected a payout account yet")

    subtotal_cents = int(round(booking["subtotal"] * 100))
    app_cut_cents = int(round(booking["app_cut"] * 100))

    def _create_session():
        return stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": booking["listing_title"]},
                    "unit_amount": subtotal_cents,
                },
                "quantity": 1,
            }],
            payment_intent_data={
                "application_fee_amount": app_cut_cents,
                "transfer_data": {"destination": owner_acct},
            },
            success_url=f"{FRONTEND_URL}/booking/{bid}?paid=1",
            cancel_url=f"{FRONTEND_URL}/booking/{bid}",
            metadata={"booking_id": bid},
        )

    try:
        session = await run_in_threadpool(_create_session)
    except Exception as e:
        logger.error(f"stripe checkout failed: {e}")
        raise HTTPException(status_code=502, detail="Could not start checkout")
    return {"checkout_url": session.url}


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe calls this when a checkout session completes. Register this URL
    (https://<your-railway-domain>/api/stripe/webhook) in the Stripe dashboard."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    def _verify():
        return stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)

    try:
        event = await run_in_threadpool(_verify)
    except Exception as e:
        logger.error(f"stripe webhook verify failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        bid = (session.get("metadata") or {}).get("booking_id")
        if bid:
            await db.bookings.update_one({"id": bid}, {"$set": {"status": "active", "paid": True, "paid_at": now_iso()}})
            booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
            if booking:
                await notify(
                    booking["owner_id"],
                    "Payment received",
                    f"Payment for {booking['listing_title']} is complete.",
                    "payment_received",
                    {"booking_id": bid},
                )
    return {"received": True}


@api.get("/settings")
async def settings_get():
    s = await get_settings()
    return {"commission_rate": s["commission_rate"]}


@api.post("/settings")
async def settings_set(data: SettingsIn, user: dict = Depends(require("admin"))):
    await db.settings.update_one({"id": "global"}, {"$set": {"commission_rate": data.commission_rate}}, upsert=True)
    return {"commission_rate": data.commission_rate}


# ========================================================= NOTIFICATIONS ======
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": n}


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/push/register")
async def register_push_token(data: PushTokenIn, user: dict = Depends(get_current_user)):
    """Called once per device after the user grants notification permission."""
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"push_tokens": data.token}})
    return {"ok": True}


@api.post("/push/unregister")
async def unregister_push_token(data: PushTokenIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"push_tokens": data.token}})
    return {"ok": True}


# ============================================================== MESSAGES ======
async def _thread_participants(context_type: str, context_id: str) -> Optional[set]:
    """Who is allowed to read/write this conversation. None if the underlying
    booking/request doesn't exist."""
    if context_type == "booking":
        b = await db.bookings.find_one({"id": context_id}, {"_id": 0, "owner_id": 1, "renter_id": 1})
        if not b:
            return None
        return {b["owner_id"], b["renter_id"]}
    if context_type == "request":
        r = await db.requests.find_one({"id": context_id}, {"_id": 0, "poster_id": 1})
        if not r:
            return None
        parts = {r["poster_id"]}
        async for bid in db.bids.find({"request_id": context_id}, {"_id": 0, "vendor_id": 1}):
            parts.add(bid["vendor_id"])
        return parts
    return None


@api.post("/messages")
async def send_message(data: MessageIn, user: dict = Depends(get_current_user)):
    participants = await _thread_participants(data.context_type, data.context_id)
    if participants is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user["id"] not in participants:
        raise HTTPException(status_code=403, detail="You're not part of this conversation")

    body = data.body.strip()
    msg = {
        "id": str(uuid.uuid4()),
        "context_type": data.context_type,
        "context_id": data.context_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "body": body,
        "read_by": [user["id"]],
        "created_at": now_iso(),
    }
    await db.messages.insert_one(dict(msg))
    msg.pop("_id", None)

    for pid in participants:
        if pid != user["id"]:
            await notify(
                pid,
                f"New message from {user['name']}",
                body[:120],
                "message",
                {"context_type": data.context_type, "context_id": data.context_id},
            )
    return msg


@api.get("/messages/{context_type}/{context_id}")
async def get_thread(context_type: str, context_id: str, user: dict = Depends(get_current_user)):
    participants = await _thread_participants(context_type, context_id)
    if participants is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user["id"] not in participants:
        raise HTTPException(status_code=403, detail="You're not part of this conversation")

    msgs = await db.messages.find(
        {"context_type": context_type, "context_id": context_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)

    await db.messages.update_many(
        {"context_type": context_type, "context_id": context_id, "read_by": {"$ne": user["id"]}},
        {"$addToSet": {"read_by": user["id"]}},
    )
    return {"messages": msgs}


@api.get("/messages/threads")
async def list_threads(user: dict = Depends(get_current_user)):
    """Every conversation this user is part of, newest first, with a preview
    and unread count — powers a Messages inbox screen."""
    threads = []

    async for b in db.bookings.find(
        {"$or": [{"owner_id": user["id"]}, {"renter_id": user["id"]}]},
        {"_id": 0, "id": 1, "listing_title": 1, "owner_id": 1, "renter_id": 1, "owner_name": 1, "renter_name": 1},
    ):
        last = await db.messages.find_one(
            {"context_type": "booking", "context_id": b["id"]}, {"_id": 0}, sort=[("created_at", -1)]
        )
        if not last:
            continue
        unread = await db.messages.count_documents(
            {"context_type": "booking", "context_id": b["id"], "read_by": {"$ne": user["id"]}}
        )
        other_name = b.get("renter_name") if user["id"] == b["owner_id"] else (b.get("owner_name") or "Owner")
        threads.append({
            "context_type": "booking", "context_id": b["id"], "title": b["listing_title"],
            "with_name": other_name, "last_message": last["body"], "last_at": last["created_at"], "unread": unread,
        })

    vendor_request_ids = [
        bid["request_id"] async for bid in db.bids.find({"vendor_id": user["id"]}, {"_id": 0, "request_id": 1})
    ]
    async for r in db.requests.find(
        {"$or": [{"poster_id": user["id"]}, {"id": {"$in": vendor_request_ids}}]},
        {"_id": 0, "id": 1, "title": 1, "poster_id": 1, "poster_name": 1},
    ):
        last = await db.messages.find_one(
            {"context_type": "request", "context_id": r["id"]}, {"_id": 0}, sort=[("created_at", -1)]
        )
        if not last:
            continue
        unread = await db.messages.count_documents(
            {"context_type": "request", "context_id": r["id"], "read_by": {"$ne": user["id"]}}
        )
        with_name = r.get("poster_name") if user["id"] != r["poster_id"] else "Bidders"
        threads.append({
            "context_type": "request", "context_id": r["id"], "title": r["title"],
            "with_name": with_name, "last_message": last["body"], "last_at": last["created_at"], "unread": unread,
        })

    threads.sort(key=lambda t: t["last_at"], reverse=True)
    return {"threads": threads}


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
    await notify(
        req["poster_id"],
        "New bid received",
        f"{user['name']} bid ${data.price:g} on {req['title']} (ETA {data.eta}).",
        "bid_received",
        {"request_id": rid},
    )
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
    await notify(
        bid["vendor_id"],
        "Your bid was accepted",
        f"You won the job: {req['title']}. Contact the poster to proceed.",
        "bid_accepted",
        {"request_id": rid},
    )
    return {"ok": True}


# ================================================================= ADMIN ======
@api.post("/admin/reseed-listings")
async def admin_reseed_listings(user: dict = Depends(require("admin"))):
    """Wipes the demo listings and re-inserts them fresh from the current seed
    data (e.g. after updating a demo listing's photos in code)."""
    result = await db.listings.delete_many({})
    await seed()
    count = await db.listings.count_documents({})
    return {"ok": True, "deleted": result.deleted_count, "reseeded": count}


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
                "latitude": 32.7767, "longitude": -96.7970,
                "daily_rate": 320, "year": 2022, "make": "Freightliner", "capacity": "80,000 lb GVWR",
                "description": "Long-haul sleeper cab, APU equipped, fresh service. Ready for OTR.",
                "photos": ["https://images.unsplash.com/photo-1779583074717-e60fa13131ce?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
            {
                "title": "48ft Reefer Trailer",
                "kind": "trailer", "category": "Reefer", "location": "Atlanta, GA",
                "latitude": 33.7490, "longitude": -84.3880,
                "daily_rate": 145, "year": 2021, "make": "Utility", "capacity": "44,000 lb",
                "description": "Carrier reefer unit, continuous run, temp logging. Perfect for cold chain loads.",
                "photos": ["https://images.unsplash.com/photo-1601467995997-ac1ae9a8fff4?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
            {
                "title": "53ft Flatbed Trailer",
                "kind": "trailer", "category": "Flatbed", "location": "Phoenix, AZ",
                "latitude": 33.4484, "longitude": -112.0740,
                "daily_rate": 110, "year": 2020, "make": "Fontaine", "capacity": "48,000 lb",
                "description": "Aluminum flatbed with straps, chains and tarps included. Steel/lumber ready.",
                "photos": ["https://images.unsplash.com/photo-1740774017942-23f80f6477c5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
            {
                "title": "Box Truck 26ft w/ Liftgate",
                "kind": "truck", "category": "Box", "location": "Chicago, IL",
                "latitude": 41.8781, "longitude": -87.6298,
                "daily_rate": 180, "year": 2023, "make": "Isuzu", "capacity": "12,000 lb",
                "description": "Non-CDL box truck, liftgate, e-track. Great for last mile and moves.",
                "photos": ["https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
            },
        ]
        ppm_list = [2.20, 1.90, 1.75, 1.40]
        for i, d in enumerate(demo):
            lat, lng = d.pop("latitude", None), d.pop("longitude", None)
            geo = {"type": "Point", "coordinates": [lng, lat]} if lat is not None and lng is not None else None
            await db.listings.insert_one({
                "id": str(uuid.uuid4()),
                "owner_id": owner["id"],
                "owner_name": owner["name"],
                **d,
                "latitude": lat,
                "longitude": lng,
                **({"geo": geo} if geo else {}),
                "price_per_mile": ppm_list[i % len(ppm_list)],
                "rating": 0,
                "rating_count": 0,
                "dot_number": f"DOT-{3900000 + i * 137}",
                "mc_number": f"MC-{800000 + i * 91}",
                "vin": f"1FUJA6CG{i}7LME0000{i}",
                "plate": f"TX-RIG{i}00",
                "insurance_provider": ["Progressive Commercial", "Sentry", "Nationwide", "Great West"][i % 4],
                "insurance_policy": f"POL-{20260000 + i}",
                "insurance_expiry": "2027-03-31",
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
    try:
        await db.listings.create_index([("geo", "2dsphere")])
    except Exception as e:
        logger.error(f"geo index creation failed: {e}")


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
