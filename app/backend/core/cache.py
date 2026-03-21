import json
import logging
import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

def _json_serial(obj):
    """Auxiliar para serializar datas e datetimes no JSON."""
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


async def fetch_with_cache(redis, pool, cache_key: str, query: str, *params, expire: int = 3600) -> list[dict[str, Any]]:
    """
    Busca dados no Redis utilizando a chave `cache_key`. 
    Se não encontrar (MISS), executa a `query` no PostgreSQL,
    converte o resultado para dicionários e salva no cache em JSON.
    """
    if redis is not None:
        try:
            cached_data = await redis.get(cache_key)
            if cached_data:
                logger.info(f"Redis Cache HIT: {cache_key}")
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Falha ao ler cache Redis (chave {cache_key}), ignorando cache: {e}")

    logger.info(f"Redis Cache MISS: {cache_key}. Consultando PostgreSQL via asyncpg...")
    
    if pool is None:
        raise RuntimeError("Database pool not initialized.")

    try:
        async with pool.acquire() as conn:
            records = await conn.fetch(query, *params)
            
            # Converte registros do asyncpg para list de dicts padrão
            resultado = [dict(record) for record in records]
            
            # Tenta salvar no cache se o Redis existir
            if redis is not None:
                json_response = json.dumps(resultado, default=_json_serial)
                try:
                    await redis.setex(cache_key, expire, json_response)
                except Exception as e:
                    logger.warning(f"Falha ao escrever no cache Redis (chave {cache_key}): {e}")
                    
            return resultado
    except Exception as e:
        logger.error(f"Erro fatal executando query PostgreSQL '{cache_key}': {e}")
        raise e
