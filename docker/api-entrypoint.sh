#!/bin/sh
# Seed once (idempotent: skipped when employees exist), then serve the API.
set -e
if [ "${SEED_ON_START:-true}" = "true" ]; then
  python -m backend.seed --count "${SEED_COUNT:-10000}"
fi
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers "${API_WORKERS:-2}" --proxy-headers
