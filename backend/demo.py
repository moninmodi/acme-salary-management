"""Serve the built React application and the salary API from one origin."""
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from backend.main import create_app

app = create_app()
app.mount("/", StaticFiles(directory=Path(__file__).resolve().parents[1] / "dist", html=True))
