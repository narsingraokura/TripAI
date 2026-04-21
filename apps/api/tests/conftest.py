from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture(autouse=True)
def set_admin_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set ADMIN_API_KEY for all tests so existing write tests get past auth."""
    monkeypatch.setenv("ADMIN_API_KEY", "test-key-12345")


@pytest.fixture(autouse=True)
def mock_classify_query():
    """Default classify_query to 'trip' so existing chat tests are unaffected."""
    with patch("routes.chat.classify_query", new=AsyncMock(return_value="trip")):
        yield
