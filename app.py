"""Optional local preview server. GitHub Pages serves the static files directly."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

APP_DIR = Path(__file__).parent

app = FastAPI(title="WTC Pairings", version="1.1.0")
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
app.mount("/data", StaticFiles(directory=APP_DIR / "data"), name="data")
if (APP_DIR / "samples").is_dir():
    app.mount("/samples", StaticFiles(directory=APP_DIR / "samples"), name="samples")


@app.get("/")
async def index():
    return FileResponse(APP_DIR / "index.html")
