"""Constantes centralizadas para o pipeline de análise.

Todos os anos, códigos e thresholds que antes estavam hardcoded
nos scripts de análise agora ficam aqui.
"""

# Período regulatório: REN 414 (até 2021) vs REN 1000 (2022+)
REN1000_CUTOFF_YEAR = 2021  # ano <= 2021 → "pre_2022"
PERIOD_LABELS = {"pre": "pre_2022", "pos": "pos_2022"}

# Faixas de anos para análises
SERIES_HISTORICA = (2011, 2023)       # série longa (indicadores anuais)
ANOS_COMPARAVEIS = (2023, 2025)       # janela operacional recente
LONGRUN_CUTOFF = 2023                 # limite para séries longas

# Normalização
PER_100K = 100_000.0  # multiplicador para "por 100 mil UCs"

# Códigos de serviço excluídos em análises alternativas
EXCLUDED_SERVICE_CODES = ("69", "93")

# Thresholds de qualidade de dados
SPIKE_THRESHOLD = 0.5    # 50% variação mês-a-mês = spike
LOW_VOLUME_SHARE = 0.01  # 1% mínimo de share para inclusão
