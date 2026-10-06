FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package*.json frontend/
RUN npm ci --prefix frontend
COPY catalog.json .
COPY frontend frontend
RUN npm run build --prefix frontend

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY catalog.json .
COPY backend backend
COPY alembic.ini .
COPY LICENSE THIRD_PARTY_NOTICES.md README.md VERIFICATION.md ./
COPY --from=frontend /app/frontend/dist frontend/dist
ENV PYTHONPATH=/app/backend
RUN useradd --create-home coalition
USER coalition
CMD ["sh", "-c", "python -m coalition.db && uvicorn coalition.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
