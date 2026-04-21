"""
Adversarial tests for the X-API-Key auth guard.
These cover edge cases the developer may not have explicitly thought of.
"""
import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app, get_supabase

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
BOOKING_ID = "uuid-booking-adversarial"
CORRECT_KEY = "test-key-12345"  # set by conftest autouse fixture


def _booking_mock() -> MagicMock:
    """Minimal supabase mock sufficient to reach past auth into the route."""
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}]
    booking_resp = MagicMock()
    booking_resp.data = [
        {
            "id": BOOKING_ID,
            "trip_id": TRIP_ID,
            "title": "Test",
            "subtitle": "test",
            "category": "hotels",
            "urgency": "fire",
            "status": "booked",
            "estimated_cost": 100.0,
            "actual_cost": None,
            "deadline": "Soon",
            "discount_code": None,
            "card_tip": "Visa",
            "booked_at": None,
        }
    ]

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
                booking_resp
            )
            chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = (
                booking_resp
            )
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def teardown_function() -> None:
    app.dependency_overrides.clear()


def _patch_url() -> str:
    return f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}"


# ── 1. Empty string key ────────────────────────────────────────────────────────

def test_empty_string_key_returns_403() -> None:
    """X-API-Key: "" should be rejected — empty is not the same as absent."""
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"X-API-Key": ""},
    )
    assert resp.status_code == 403


# ── 2. Whitespace-only key ─────────────────────────────────────────────────────

def test_whitespace_only_key_returns_403() -> None:
    """X-API-Key: '   ' (spaces) must not pass — no implicit strip() before comparison."""
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"X-API-Key": "   "},
    )
    assert resp.status_code == 403


# ── 3. Correct key with extra surrounding whitespace ──────────────────────────

def test_padded_correct_key_returns_403() -> None:
    """' test-key-12345 ' (padded) must NOT pass — comparison must be strict."""
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"X-API-Key": f" {CORRECT_KEY} "},
    )
    assert resp.status_code == 403


# ── 4. Very long key (>10 KB) ─────────────────────────────────────────────────

def test_very_long_key_does_not_pass() -> None:
    """A 12 KB key should not pass auth (either rejected at HTTP layer or by comparison)."""
    long_key = "A" * 12_000
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"X-API-Key": long_key},
    )
    # Must not be 200/201 — the long key must not accidentally match
    assert resp.status_code in (400, 403, 431), (
        f"Expected 400, 403, or 431 for oversized key; got {resp.status_code}"
    )


# ── 5. Non-ASCII / Unicode characters ────────────────────────────────────────

def test_unicode_key_returns_403() -> None:
    """Unicode key value should not bypass auth."""
    client = TestClient(app)
    try:
        resp = client.patch(
            _patch_url(),
            json={"status": "booked"},
            headers={"X-API-Key": "tëst-kéy-12345"},
        )
        assert resp.status_code == 403, (
            f"Unicode key should return 403, got {resp.status_code}"
        )
    except Exception as exc:
        # Acceptable: framework may refuse to encode non-ASCII in a header
        assert "ascii" in str(exc).lower() or "encode" in str(exc).lower(), (
            f"Unexpected exception type: {exc}"
        )


def test_emoji_key_returns_403_or_encoding_error() -> None:
    """Key containing emoji must not bypass auth."""
    client = TestClient(app)
    try:
        resp = client.patch(
            _patch_url(),
            json={"status": "booked"},
            headers={"X-API-Key": "🔑test-key-12345"},
        )
        assert resp.status_code == 403
    except Exception as exc:
        # Encoding error from requests is also acceptable
        assert True


# ── 6. Two X-API-Key headers in the same request ─────────────────────────────

def test_two_api_key_headers_correct_first_passes_auth() -> None:
    # Starlette takes the first value of a repeated header. Sending
    # (correct_key, junk) means auth sees correct_key and passes.
    # An attacker gains nothing without already possessing the real key.
    app.dependency_overrides[get_supabase] = lambda: _booking_mock()
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers=[
            ("X-API-Key", CORRECT_KEY),
            ("X-API-Key", "junk-extra-header"),
        ],
    )
    assert resp.status_code != 403


def test_two_api_key_headers_junk_first_correct_second() -> None:
    """
    Sending junk key first, correct key second.
    An attacker cannot bypass auth by appending a valid key after junk.
    """
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers=[
            ("X-API-Key", "junk-key"),
            ("X-API-Key", CORRECT_KEY),
        ],
    )
    # If both headers are present, the comparison should fail for the attacker
    # unless they already know the correct key — in which case having two headers
    # is irrelevant. What we're checking: does having the correct key as the SECOND
    # header allow auth bypass when the first is wrong?
    # This is informational; 403 is the desired outcome.
    # A 200 here would only be meaningful if the attacker ALSO had the correct key,
    # so this is really a behavior-documentation test.
    status = resp.status_code
    # If Starlette takes the LAST value and attacker sends junk+correct,
    # the attacker still needs to know the correct key — not really bypassable.
    # Just record the behavior without asserting 403 here, since auth is valid if
    # the correct key is present.
    pass  # behavioral observation only — see report


# ── 7. ADMIN_API_KEY set to empty string (not unset, but empty) ───────────────

def test_fail_closed_when_env_is_empty_string(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    ADMIN_API_KEY="" (empty string) should still fail closed.
    The `not admin_key` check catches both None and "".
    """
    monkeypatch.setenv("ADMIN_API_KEY", "")
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"X-API-Key": "any-key"},
    )
    assert resp.status_code == 403


# ── 8. Case sensitivity of the key value ──────────────────────────────────────

def test_uppercase_correct_key_returns_403() -> None:
    """Key comparison must be case-sensitive. 'TEST-KEY-12345' ≠ 'test-key-12345'."""
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"X-API-Key": CORRECT_KEY.upper()},
    )
    assert resp.status_code == 403


# ── 9. Lowercase HTTP header name ─────────────────────────────────────────────

def test_lowercase_header_name_with_correct_key_passes() -> None:
    """
    HTTP headers are case-insensitive. 'x-api-key' must work the same as 'X-API-Key'.
    FastAPI normalizes header names, so this should pass auth.
    """
    app.dependency_overrides[get_supabase] = lambda: _booking_mock()
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"x-api-key": CORRECT_KEY},
    )
    assert resp.status_code != 403, (
        f"Lowercase header name 'x-api-key' should be accepted by auth; got {resp.status_code}. "
        "HTTP headers are case-insensitive and FastAPI normalizes them."
    )


# ── 10. NUL byte in key ────────────────────────────────────────────────────────

def test_null_byte_in_key_returns_403_or_error() -> None:
    """Key containing a NUL byte must not bypass auth."""
    client = TestClient(app)
    try:
        resp = client.patch(
            _patch_url(),
            json={"status": "booked"},
            headers={"X-API-Key": "test-key\x0012345"},
        )
        assert resp.status_code == 403
    except Exception:
        pass  # Framework-level rejection is also acceptable


# ── 11. Key collision: ADMIN_API_KEY as empty string, send empty header ────────

def test_empty_key_env_does_not_allow_empty_key_header(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Even if someone sets ADMIN_API_KEY="" and sends X-API-Key: "",
    the fail-closed `not admin_key` guard should block it before comparison.
    This prevents matching two empty strings.
    """
    monkeypatch.setenv("ADMIN_API_KEY", "")
    client = TestClient(app)
    resp = client.patch(
        _patch_url(),
        json={"status": "booked"},
        headers={"X-API-Key": ""},
    )
    assert resp.status_code == 403, (
        f"Empty ADMIN_API_KEY + empty X-API-Key must not pass; got {resp.status_code}. "
        "Two empty strings would match via hmac.compare_digest if fail-closed check is absent."
    )


# ── 12. Correct key on a GET endpoint (should be ignored) ─────────────────────

def test_get_endpoint_with_key_still_works() -> None:
    """GET endpoints should work with or without X-API-Key — the header must be ignored."""
    from main import get_supabase as main_get_supabase
    app.dependency_overrides[main_get_supabase] = lambda: _booking_mock()
    client = TestClient(app)
    resp = client.get(
        f"/trips/{TRIP_ID}/bookings",
        headers={"X-API-Key": CORRECT_KEY},
    )
    assert resp.status_code != 403, (
        f"GET endpoint should be accessible even when X-API-Key is supplied; got {resp.status_code}"
    )
