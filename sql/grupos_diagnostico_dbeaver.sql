-- SQL de apoio para executar blocos pesados do grupos_diagnostico no PostgreSQL (DBeaver)
-- Fontes esperadas no schema atual:
--   - fato_servicos_municipio_mes
--   - fato_transgressao_mensal_distribuidora
--   - dim_distributor_group
--
-- Este script materializa 3 saídas equivalentes ao pipeline Python:
--   1) grupos_share_codigos_69_93
--   2) grupos_anual_sem_cod_69_93
--   3) grupos_alertas_comparabilidade

BEGIN;

-- Ajuste o schema alvo se necessario (ex.: analytics, stage, etc.).
-- Mantemos public como default para evitar ambiguidade no DBeaver.
SET LOCAL search_path TO public;

-- ============================================
-- Índices recomendados (se as tabelas forem grandes)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_servicos_grp_dist_ano_mes_cod
    ON fato_servicos_municipio_mes (group_id, distributor_id, ano, mes, codtiposervico);

CREATE INDEX IF NOT EXISTS idx_mensal_grp_dist_ano_mes
    ON fato_transgressao_mensal_distribuidora (group_id, distributor_id, ano, mes);

CREATE INDEX IF NOT EXISTS idx_dim_grp_dist
    ON dim_distributor_group (group_id, distributor_id);

-- ============================================
-- 1) Share dos códigos 69/93
-- ============================================
DROP TABLE IF EXISTS grupos_share_codigos_69_93;

CREATE TABLE grupos_share_codigos_69_93 AS
WITH dim AS (
    SELECT DISTINCT group_id, distributor_id, group_label, distributor_label
    FROM dim_distributor_group
),
base AS (
    SELECT
        s.group_id,
        d.group_label,
        s.distributor_id,
        COALESCE(s.distributor_label, d.distributor_label) AS distributor_label,
        s.ano,
        s.qtd_serv_realizado,
        CASE
            WHEN btrim(COALESCE(s.codtiposervico, '')) IN ('69', '93') THEN s.qtd_serv_realizado
            ELSE 0.0
        END AS serv_focus
    FROM fato_servicos_municipio_mes s
    LEFT JOIN dim d
        ON d.group_id = s.group_id
       AND d.distributor_id = s.distributor_id
    WHERE s.ano BETWEEN 2023 AND 2025
)
SELECT
    group_id,
    group_label,
    distributor_id,
    distributor_label,
    ano,
    SUM(qtd_serv_realizado) AS total_serv,
    SUM(serv_focus) AS serv_focus,
    CASE
        WHEN SUM(qtd_serv_realizado) > 0::numeric
        THEN SUM(serv_focus)::double precision
             / NULLIF(SUM(qtd_serv_realizado)::double precision, 0.0)
        ELSE NULL
    END AS share_serv_focus
FROM base
GROUP BY group_id, group_label, distributor_id, distributor_label, ano
ORDER BY group_id, distributor_label, ano;

-- ============================================
-- 2) Anual sem códigos 69/93
-- ============================================
DROP TABLE IF EXISTS grupos_anual_sem_cod_69_93;

CREATE TABLE grupos_anual_sem_cod_69_93 AS
WITH dim AS (
    SELECT DISTINCT group_id, distributor_id, group_label, distributor_label
    FROM dim_distributor_group
),
servicos_filtrados AS (
    SELECT
        s.group_id,
        d.group_label,
        s.distributor_id,
        COALESCE(s.distributor_label, d.distributor_label) AS distributor_label,
        s.ano,
        s.mes,
        SUM(s.qtd_serv_realizado) AS qtd_serv_realizado,
        SUM(s.qtd_fora_prazo) AS qtd_fora_prazo,
        SUM(s.compensacao_rs) AS compensacao_rs
    FROM fato_servicos_municipio_mes s
    LEFT JOIN dim d
        ON d.group_id = s.group_id
       AND d.distributor_id = s.distributor_id
    WHERE s.ano BETWEEN 2023 AND 2025
      AND btrim(COALESCE(s.codtiposervico, '')) NOT IN ('69', '93')
    GROUP BY
        s.group_id,
        d.group_label,
        s.distributor_id,
        COALESCE(s.distributor_label, d.distributor_label),
        s.ano,
        s.mes
),
uc AS (
    SELECT DISTINCT
        group_id,
        distributor_id,
        ano,
        mes,
        uc_ativa_mes
    FROM fato_transgressao_mensal_distribuidora
)
SELECT
    f.group_id,
    f.group_label,
    f.distributor_id,
    f.distributor_label,
    f.ano,
    SUM(f.qtd_serv_realizado) AS qtd_serv_realizado,
    SUM(f.qtd_fora_prazo) AS qtd_fora_prazo,
    SUM(f.compensacao_rs) AS compensacao_rs,
    SUM(u.uc_ativa_mes) AS exposicao_uc_mes,
    CASE
        WHEN SUM(f.qtd_serv_realizado) > 0::numeric
        THEN SUM(f.qtd_fora_prazo)::double precision
             / NULLIF(SUM(f.qtd_serv_realizado)::double precision, 0.0)
        ELSE NULL
    END AS taxa_fora_prazo,
    CASE
        WHEN SUM(u.uc_ativa_mes) > 0::numeric
        THEN SUM(f.qtd_fora_prazo)::double precision
             / NULLIF(SUM(u.uc_ativa_mes)::double precision, 0.0)
             * 100000.0
        ELSE NULL
    END AS fora_prazo_por_100k_uc_mes,
    CASE
        WHEN SUM(u.uc_ativa_mes) > 0::numeric
        THEN SUM(f.compensacao_rs)::double precision
             / NULLIF(SUM(u.uc_ativa_mes)::double precision, 0.0)
        ELSE NULL
    END AS compensacao_rs_por_uc_mes,
    'sem_cod_69_93'::text AS escopo_servico
FROM servicos_filtrados f
LEFT JOIN uc u
    ON u.group_id = f.group_id
   AND u.distributor_id = f.distributor_id
   AND u.ano = f.ano
   AND u.mes = f.mes
GROUP BY
    f.group_id,
    f.group_label,
    f.distributor_id,
    f.distributor_label,
    f.ano
ORDER BY f.group_id, f.distributor_label, f.ano;

-- ============================================
-- 3) Alertas de comparabilidade
-- ============================================
DROP TABLE IF EXISTS grupos_alertas_comparabilidade;

CREATE TABLE grupos_alertas_comparabilidade AS
WITH annual AS (
    SELECT
        m.group_id,
        d.group_label,
        m.distributor_id,
        COALESCE(m.distributor_label, d.distributor_label) AS distributor_label,
        m.ano,
        SUM(m.qtd_serv_realizado) AS qtd_serv_realizado
    FROM fato_transgressao_mensal_distribuidora m
    LEFT JOIN (
        SELECT DISTINCT group_id, distributor_id, group_label, distributor_label
        FROM dim_distributor_group
    ) d
        ON d.group_id = m.group_id
       AND d.distributor_id = m.distributor_id
    WHERE m.ano BETWEEN 2023 AND 2025
    GROUP BY
        m.group_id,
        d.group_label,
        m.distributor_id,
        COALESCE(m.distributor_label, d.distributor_label),
        m.ano
),
vol AS (
    SELECT
        a.*,
        CASE
            WHEN LAG(a.qtd_serv_realizado) OVER (PARTITION BY a.group_id, a.distributor_id ORDER BY a.ano) > 0::numeric
            THEN a.qtd_serv_realizado::double precision
                 / NULLIF(
                     LAG(a.qtd_serv_realizado) OVER (PARTITION BY a.group_id, a.distributor_id ORDER BY a.ano)::double precision,
                     0.0
                 )
                 - 1.0
            ELSE NULL
        END AS delta_serv_pct
    FROM annual a
),
mix AS (
    SELECT
        s.group_id,
        s.distributor_id,
        s.ano,
        s.share_serv_focus,
        s.share_serv_focus
          - LAG(s.share_serv_focus) OVER (PARTITION BY s.group_id, s.distributor_id ORDER BY s.ano)
          AS delta_share_focus_abs
    FROM grupos_share_codigos_69_93 s
),
joined AS (
    SELECT
        v.group_id,
        v.group_label,
        v.distributor_id,
        v.distributor_label,
        v.ano,
        v.qtd_serv_realizado,
        v.delta_serv_pct,
        m.share_serv_focus,
        m.delta_share_focus_abs,
        (ABS(v.delta_serv_pct) >= 0.5) AS alerta_quebra_volume,
        (ABS(m.delta_share_focus_abs) >= 0.3) AS alerta_quebra_mix
    FROM vol v
    LEFT JOIN mix m
        ON m.group_id = v.group_id
       AND m.distributor_id = v.distributor_id
       AND m.ano = v.ano
)
SELECT *
FROM joined
WHERE alerta_quebra_volume OR alerta_quebra_mix
ORDER BY group_id, distributor_label, ano;

COMMIT;
