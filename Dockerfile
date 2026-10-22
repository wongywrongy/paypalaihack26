FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package*.json frontend/
RUN npm ci --prefix frontend
COPY design/scenario design/scenario
COPY frontend frontend
RUN npm run build --prefix frontend

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY scripts scripts
COPY design/scenario design/scenario
COPY LICENSE THIRD_PARTY_NOTICES.md README.md EVIDENCE.md ./
COPY --from=frontend /app/frontend/dist frontend/dist
ENV PYTHONPATH=/app/backend
RUN useradd --create-home rally
USER rally
CMD ["sh", "-c", "python -m rally.db && uvicorn rally.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
