"""Prevent accidental fixture-server startup without explicit test configuration."""

import pytest

from tests.fixture_backend import create_fixture_app


def test_browser_fixture_requires_explicit_testing_mode(monkeypatch):
    monkeypatch.delenv("BIDBRIDGE_TEST_MODE", raising=False)
    with pytest.raises(RuntimeError, match="explicit BIDBRIDGE_TEST_MODE=1"):
        create_fixture_app()
