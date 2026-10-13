"""
FastAPI Backend Application Main Entry Point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.storage.db import init_db
from app.api.v1.health import router as health_router
from app.api.v1.runs import router as runs_router
from app.api.v1.results import router as results_router
from app.api.v1.compare import router as compare_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup initialization
    init_db()
    settings.get_output_dir()
    settings.get_runs_dir()
    yield
    # Shutdown cleanup if needed


app = FastAPI(
    title="Pump Anomaly Detection ML Diagnostic API",
    description="Backend API for CRNN model training, test set evaluation, and LLM diagnostic reporting.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows local dev frontend from any origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Routers
app.include_router(health_router, prefix="/api/v1", tags=["Health & Capabilities"])
app.include_router(runs_router, prefix="/api/v1", tags=["Runs & Execution"])
app.include_router(results_router, prefix="/api/v1", tags=["Results & Metrics"])
app.include_router(compare_router, prefix="/api/v1", tags=["Run Comparison"])

# Mount static artifacts directory
runs_dir = settings.get_runs_dir()
app.mount("/artifacts", StaticFiles(directory=str(settings.get_output_dir())), name="artifacts")


@app.get("/")
def root():
    return {
        "title": "Pump Audio Diagnostic Agent API",
        "docs": "/docs",
        "health": "/api/v1/health",
        "capabilities": "/api/v1/capabilities",
    }
