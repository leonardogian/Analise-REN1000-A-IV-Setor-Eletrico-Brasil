import os
import asyncpg
from redis import asyncio as aioredis
import logging

logger = logging.getLogger(__name__)

# Configurações de conexão padrão, permitindo sobrescrita por variáveis de ambiente
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:adminpassword@localhost:5432/tcc_db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class DatabaseManager:
    def __init__(self):
        self.pool = None
        self.redis = None

    async def connect(self):
        """Inicializa os pools de conexão para PostgreSQL e Redis."""
        logger.info("Conectando ao PostgreSQL...")
        try:
            self.pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=1, max_size=10)
            logger.info("PostgreSQL conectado.")
        except Exception as e:
            logger.error(f"Erro ao conectar ao PostgreSQL: {e}")
        
        logger.info("Conectando ao Redis...")
        try:
            self.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            await self.redis.ping()
            logger.info("Redis conectado.")
        except Exception as e:
            logger.error(f"Erro ao conectar ao Redis: {e}")

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
