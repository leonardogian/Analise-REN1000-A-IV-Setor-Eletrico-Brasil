FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY src /app/src
COPY app /app/app
COPY data /app/data
COPY scripts /app/scripts

# Gerar todos os JSON files do frontend a partir dos CSVs versionados
RUN python3 -m src.analysis.build_dashboard_data && \
    python3 -m src.analysis.dashboard_transgressoes

EXPOSE 8051

# Add a non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.backend.main:app", "--host", "0.0.0.0", "--port", "8051"]
