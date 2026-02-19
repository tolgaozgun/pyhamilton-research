from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.simple import router as simple_router
from app.api.routes.developer import router as developer_router
from app.api.routes.agentic import router as agentic_router
from app.api.routes.config_routes import router as config_router

app = FastAPI(
    title="PyHamilton Automation Agent",
    description="AI-powered PyHamilton script generation backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simple_router)
app.include_router(developer_router)
app.include_router(agentic_router)
app.include_router(config_router)


@app.get("/")
async def root():
    return {
        "name": "PyHamilton Automation Agent",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
