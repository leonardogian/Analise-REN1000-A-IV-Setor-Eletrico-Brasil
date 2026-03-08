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

EXPOSE 8050

CMD ["uvicorn", "app.backend.main:app", "--host", "0.0.0.0", "--port", "8050"]
