"""Smoke tests for backend behavior when optional services are unavailable."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.backend import main as backend_main
from app.backend.core import database


async def _never_connect(*_args, **_kwargs):
    await asyncio.sleep(10)


class _HangingRedis:
    async def ping(self) -> None:
        await asyncio.sleep(10)


def test_database_connect_has_short_failure_window() -> None:
    original_create_pool = database.asyncpg.create_pool
    original_from_url = database.aioredis.from_url
    original_timeout = database.DEPENDENCY_CONNECT_TIMEOUT_SECONDS

    async def run() -> None:
        manager = database.DatabaseManager()
        database.asyncpg.create_pool = _never_connect
        database.aioredis.from_url = lambda *_args, **_kwargs: _HangingRedis()
        database.DEPENDENCY_CONNECT_TIMEOUT_SECONDS = 0.1
        try:
            await asyncio.wait_for(manager.connect(), timeout=1.0)
        finally:
            database.asyncpg.create_pool = original_create_pool
            database.aioredis.from_url = original_from_url
            database.DEPENDENCY_CONNECT_TIMEOUT_SECONDS = original_timeout

        assert manager.pool is None
        assert manager.redis is None

    asyncio.run(run())


def test_health_reports_dashboard_artifacts_independently() -> None:
    async def run() -> dict:
        original_pool = backend_main.db_manager.pool
        original_redis = backend_main.db_manager.redis
        backend_main.db_manager.pool = None
        backend_main.db_manager.redis = None
        try:
            return await backend_main.health()
        finally:
            backend_main.db_manager.pool = original_pool
            backend_main.db_manager.redis = original_redis

    payload = asyncio.run(run())

    assert payload["status"] in {"ok", "degraded"}
    assert payload["dashboard_artifacts_ready"] is True
    assert payload["database_connected"] is False
    assert payload["redis_connected"] is False


if __name__ == "__main__":
    test_database_connect_has_short_failure_window()
    test_health_reports_dashboard_artifacts_independently()
    print("Backend dependency degradation smoke passed.")
