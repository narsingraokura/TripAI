from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture(autouse=True)
def mock_classify_query():
    """Default classify_query to 'trip' so existing chat tests are unaffected."""
    with patch("routes.chat.classify_query", new=AsyncMock(return_value="trip")):
        yield
