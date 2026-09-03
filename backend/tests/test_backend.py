"""RigRent backend integration tests."""
import uuid
import os
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fleet-rent-check.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- Auth ----------
def test_login_seeds_work(s):
    for email, pw in [
        ("admin@rigrent.com", "Admin12345!"),
        ("owner@rigrent.com", "Owner12345!"),
        ("renter@rigrent.com", "Renter12345!"),
        ("vendor@rigrent.com", "Vendor12345!"),
    ]:
        r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, f"{email}: {r.text}"
        j = r.json()
        assert "token" in j and j["user"]["email"] == email


def test_login_bad_password(s):
    r = s.post(f"{API}/auth/login", json={"email": "admin@rigrent.com", "password": "wrong"})
    assert r.status_code == 401


def test_register_admin_downgrades_to_renter(s):
    email = f"TEST_admin_{uuid.uuid4().hex[:8]}@x.com"
    r = s.post(f"{API}/auth/register", json={"name": "T", "email": email, "password": "test123", "role": "admin"})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "renter"


def test_register_duplicate_conflict(s):
    r = s.post(f"{API}/auth/register", json={"name": "X", "email": "admin@rigrent.com", "password": "Admin12345!", "role": "renter"})
    assert r.status_code == 409


def test_me(s, renter_token):
    r = s.get(f"{API}/auth/me", headers=auth(renter_token))
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "renter@rigrent.com"
    assert body["license_verified"] is False  # seed intent


def test_me_no_token(s):
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---------- Listings ----------
def test_listings_public(s):
    r = s.get(f"{API}/listings")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) >= 4
    assert all("_id" not in it for it in items)
    assert all("daily_rate" in it and "category" in it for it in items)


def test_listing_detail(s):
    items = s.get(f"{API}/listings").json()
    lid = items[0]["id"]
    r = s.get(f"{API}/listings/{lid}")
    assert r.status_code == 200
    assert r.json()["id"] == lid


def test_create_listing_renter_forbidden(s, renter_token):
    r = s.post(f"{API}/listings", headers=auth(renter_token),
               json={"title": "T", "kind": "truck", "category": "Box", "location": "Y", "daily_rate": 100})
    assert r.status_code == 403


def test_create_listing_owner_and_delete(s, owner_token):
    payload = {"title": "TEST Rig", "kind": "truck", "category": "Box",
               "location": "TEST City", "daily_rate": 99.5, "year": 2024, "photos": ["http://x/y.jpg"]}
    r = s.post(f"{API}/listings", headers=auth(owner_token), json=payload)
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    # get by id
    r2 = s.get(f"{API}/listings/{lid}")
    assert r2.status_code == 200 and r2.json()["title"] == "TEST Rig"
    # mine
    mine = s.get(f"{API}/listings/mine", headers=auth(owner_token)).json()
    assert any(x["id"] == lid for x in mine)
    # delete
    d = s.delete(f"{API}/listings/{lid}", headers=auth(owner_token))
    assert d.status_code == 200
    # gone from public
    r3 = s.get(f"{API}/listings/{lid}")
    assert r3.status_code == 404


# ---------- Settings ----------
def test_settings_public_get(s):
    r = s.get(f"{API}/settings")
    assert r.status_code == 200
    rate = r.json()["commission_rate"]
    assert 0 <= rate <= 0.5


def test_settings_non_admin_forbidden(s, owner_token):
    r = s.post(f"{API}/settings", headers=auth(owner_token), json={"commission_rate": 0.2})
    assert r.status_code == 403


def test_settings_admin_update(s, admin_token):
    orig = s.get(f"{API}/settings").json()["commission_rate"]
    r = s.post(f"{API}/settings", headers=auth(admin_token), json={"commission_rate": 0.2})
    assert r.status_code == 200
    assert s.get(f"{API}/settings").json()["commission_rate"] == 0.2
    # restore
    s.post(f"{API}/settings", headers=auth(admin_token), json={"commission_rate": orig})


# ---------- Bookings ----------
def test_booking_blocked_when_unverified(s, renter_token):
    listing = s.get(f"{API}/listings").json()[0]
    payload = {"listing_id": listing["id"], "start_date": "2030-01-01", "end_date": "2030-01-03",
               "days": 2, "load_type": "General", "pickup": "A", "dropoff": "B"}
    r = s.post(f"{API}/bookings", headers=auth(renter_token), json=payload)
    assert r.status_code == 403
    assert "license" in r.json()["detail"].lower()


def test_incoming_bookings_owner(s, owner_token):
    r = s.get(f"{API}/bookings/incoming", headers=auth(owner_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_incoming_bookings_renter_forbidden(s, renter_token):
    r = s.get(f"{API}/bookings/incoming", headers=auth(renter_token))
    assert r.status_code == 403


# ---------- AI Verification (license/insurance) ----------
def test_verify_license_flow(s, license_b64):
    # register a fresh renter so we don't pollute seed
    email = f"TEST_lic_{uuid.uuid4().hex[:8]}@x.com"
    reg = s.post(f"{API}/auth/register", json={"name": "TestLicRenter", "email": email, "password": "test123", "role": "renter"}).json()
    token = reg["token"]
    r = s.post(f"{API}/verify/document", headers=auth(token),
               json={"doc_type": "license", "image_base64": license_b64}, timeout=90)
    assert r.status_code in (200, 502), r.text
    if r.status_code == 502:
        import pytest
        pytest.skip("AI service unavailable")
    body = r.json()
    assert "passed" in body and "status" in body and "extracted" in body
    # verify status endpoint reflects
    st = s.get(f"{API}/verify/status", headers=auth(token)).json()
    assert "license_verified" in st
    return token, body


def test_verify_insurance_flow(s, insurance_b64, owner_token):
    r = s.post(f"{API}/verify/document", headers=auth(owner_token),
               json={"doc_type": "insurance", "image_base64": insurance_b64}, timeout=90)
    assert r.status_code in (200, 502)
    if r.status_code == 200:
        body = r.json()
        assert "passed" in body


# ---------- Booking after verification + commission math ----------
def test_booking_math_after_verify(s, license_b64, admin_token):
    email = f"TEST_book_{uuid.uuid4().hex[:8]}@x.com"
    reg = s.post(f"{API}/auth/register", json={"name": "BookRenter", "email": email, "password": "test123", "role": "renter"}).json()
    token = reg["token"]
    v = s.post(f"{API}/verify/document", headers=auth(token),
               json={"doc_type": "license", "image_base64": license_b64}, timeout=90)
    if v.status_code != 200 or not v.json().get("passed"):
        import pytest
        pytest.skip(f"license verification did not pass: {v.status_code} {v.text[:200]}")

    listing = s.get(f"{API}/listings").json()[0]
    rate = s.get(f"{API}/settings").json()["commission_rate"]
    days = 3
    payload = {"listing_id": listing["id"], "start_date": "2030-01-01", "end_date": "2030-01-04",
               "days": days, "load_type": "TEST Load", "pickup": "A", "dropoff": "B"}
    r = s.post(f"{API}/bookings", headers=auth(token), json=payload)
    assert r.status_code == 200, r.text
    b = r.json()
    expected_subtotal = round(listing["daily_rate"] * days, 2)
    expected_cut = round(expected_subtotal * rate, 2)
    expected_owner = round(expected_subtotal - expected_cut, 2)
    assert b["subtotal"] == expected_subtotal
    assert b["app_cut"] == expected_cut
    assert b["owner_earnings"] == expected_owner
    assert b["commission_rate"] == rate

    # mine
    mine = s.get(f"{API}/bookings/mine", headers=auth(token)).json()
    assert any(x["id"] == b["id"] for x in mine)


# ---------- Roadside bidding ----------
def test_roadside_bid_flow(s, renter_token, vendor_token):
    req = s.post(f"{API}/requests", headers=auth(renter_token),
                 json={"title": "TEST tow", "category": "tow", "location": "Somewhere",
                       "description": "flat tire"}).json()
    rid = req["id"]
    # Vendor sees it
    listed = s.get(f"{API}/requests", headers=auth(vendor_token)).json()
    assert any(r["id"] == rid for r in listed)
    # Renter should NOT be able to bid
    bad = s.post(f"{API}/requests/{rid}/bids", headers=auth(renter_token),
                 json={"price": 100, "eta": "1h"})
    assert bad.status_code == 403
    # Vendor bids twice
    b1 = s.post(f"{API}/requests/{rid}/bids", headers=auth(vendor_token),
                json={"price": 250, "eta": "2h"}).json()
    b2 = s.post(f"{API}/requests/{rid}/bids", headers=auth(vendor_token),
                json={"price": 150, "eta": "3h"}).json()
    # Get request - bids sorted ascending
    detail = s.get(f"{API}/requests/{rid}", headers=auth(renter_token)).json()
    prices = [b["price"] for b in detail["bids"]]
    assert prices == sorted(prices)
    assert prices[0] == 150
    # Accept cheapest (poster only)
    ac = s.post(f"{API}/requests/{rid}/accept", headers=auth(renter_token), json={"bid_id": b2["id"]})
    assert ac.status_code == 200
    # After accept, closed
    bad2 = s.post(f"{API}/requests/{rid}/bids", headers=auth(vendor_token),
                  json={"price": 100, "eta": "5h"})
    assert bad2.status_code == 400
    # non-poster cannot accept
    other = s.post(f"{API}/requests/{rid}/accept", headers=auth(vendor_token), json={"bid_id": b1["id"]})
    assert other.status_code in (403, 404)


# ---------- Admin verifications ----------
def test_admin_verifications_list(s, admin_token, renter_token):
    r = s.get(f"{API}/admin/verifications", headers=auth(admin_token))
    assert r.status_code == 200
    # renter shouldn't
    r2 = s.get(f"{API}/admin/verifications", headers=auth(renter_token))
    assert r2.status_code == 403
