import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fleet-rent-check.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture(scope="session")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token(s):
    return _login(s, "admin@rigrent.com", "Admin12345!")


@pytest.fixture(scope="session")
def owner_token(s):
    return _login(s, "owner@rigrent.com", "Owner12345!")


@pytest.fixture(scope="session")
def renter_token(s):
    return _login(s, "renter@rigrent.com", "Renter12345!")


@pytest.fixture(scope="session")
def vendor_token(s):
    return _login(s, "vendor@rigrent.com", "Vendor12345!")


@pytest.fixture(scope="session")
def license_b64():
    with open("/tmp/lic.jpg", "rb") as f:
        return base64.b64encode(f.read()).decode()


@pytest.fixture(scope="session")
def insurance_b64():
    with open("/tmp/ins.jpg", "rb") as f:
        return base64.b64encode(f.read()).decode()


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
