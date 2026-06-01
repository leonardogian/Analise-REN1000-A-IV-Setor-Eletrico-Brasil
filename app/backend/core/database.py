import os
import asyncio
import asyncpg
from redis import asyncio as aioredis
import logging

logger = logging.getLogger(__name__)

# Configurações de conexão padrão, permitindo sobrescrita por variáveis de ambiente
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:adminpassword@localhost:5432/tcc_db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def _read_timeout_seconds() -> float:
    try:
        return max(0.1, float(os.getenv("DEPENDENCY_CONNECT_TIMEOUT_SECONDS", "2.5")))
    except ValueError:
        return 2.5


def _format_error(exc: Exception) -> str:
    text = str(exc)
    return f"{type(exc).__name__}: {text}" if text else type(exc).__name__


DEPENDENCY_CONNECT_TIMEOUT_SECONDS = _read_timeout_seconds()

class DatabaseManager:
    def __init__(self):
        self.pool = None
        self.redis = None

    async def connect(self):
        """Inicializa os pools de conexão para PostgreSQL e Redis."""
        logger.info("Conectando ao PostgreSQL...")
        try:
            self.pool = await asyncio.wait_for(
                asyncpg.create_pool(dsn=DATABASE_URL, min_size=1, max_size=10),
                timeout=DEPENDENCY_CONNECT_TIMEOUT_SECONDS,
            )
            logger.info("PostgreSQL conectado.")
        except Exception as e:
            self.pool = None
            logger.warning(
                "PostgreSQL indisponivel; backend seguira em modo JSON: "
                f"{_format_error(e)}"
            )
        
        logger.info("Conectando ao Redis...")
        redis_client = None
        try:
            redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
            await asyncio.wait_for(
                redis_client.ping(),
                timeout=DEPENDENCY_CONNECT_TIMEOUT_SECONDS,
            )
            self.redis = redis_client
            logger.info("Redis conectado.")
        except Exception as e:
            self.redis = None
            if redis_client is not None:
                try:
                    await redis_client.close()
                except Exception:
                    pass
            logger.warning(
                "Redis indisponivel; backend seguira sem cache: "
                f"{_format_error(e)}"
            )

    async def disconnect(self):
        """Encerra os pools de conexão de forma graciosa."""
        if self.pool:
            logger.info("Fechando conexões do PostgreSQL...")
            await self.pool.close()
        
        if self.redis:
            logger.info("Fechando conexões do Redis...")
            await self.redis.close()

db_manager = DatabaseManager()

async def get_db_pool():
    if db_manager.pool is None:
        raise RuntimeError("Database pool not initialized.")
    return db_manager.pool

async def get_redis():
    if db_manager.redis is None:
        raise RuntimeError("Redis connection not initialized.")
    return db_manager.redis
