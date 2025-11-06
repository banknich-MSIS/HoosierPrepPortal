from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import sys
import os

# Use relative imports (works when run as a module: python -m uvicorn server.main:app)
from .db import Base, engine
from .routes import files as files_routes
from .routes import concepts as concepts_routes
from .routes import exam as exam_routes
from .routes import dashboard as dashboard_routes
from .routes import classes as classes_routes
from .routes import ai_generation as ai_routes
from .routes import jobs as jobs_routes


def create_app() -> FastAPI:
    app = FastAPI(title="Hoosier Prep Portal API", version="0.1.0")

    # CORS for Vite dev server and Electron
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "file://",  # Electron file:// protocol
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(files_routes.router, prefix="/api")
    app.include_router(concepts_routes.router, prefix="/api")
    app.include_router(exam_routes.router, prefix="/api")
    app.include_router(dashboard_routes.router, prefix="/api")
    app.include_router(classes_routes.router, prefix="/api")
    app.include_router(ai_routes.router, prefix="/api")
    app.include_router(jobs_routes.router, prefix="/api")

    @app.on_event("startup")
    def _startup() -> None:
        # Create tables on startup for local dev
        Base.metadata.create_all(bind=engine)

    @app.get("/api/health")
    def health_check():
        """Health check endpoint for Electron to verify backend is ready"""
        return {"status": "ok", "service": "Hoosier Prep Portal API"}

    return app


app = create_app()

if __name__ == "__main__":
    # Allow running backend with custom port for Electron
    port = 8000
    if len(sys.argv) > 1:
        # Parse --port argument (handles both --port=8001 and --port 8001 formats)
        for i, arg in enumerate(sys.argv[1:], start=1):
            if arg.startswith('--port='):
                try:
                    port = int(arg.split('=')[1])
                    break
                except ValueError:
                    pass
            elif arg == '--port':
                # Check if next argument exists and is a number
                if i < len(sys.argv) - 1:
                    try:
                        port = int(sys.argv[i + 1])
                        break
                    except (ValueError, IndexError):
                        pass
    
    # Determine database path
    if getattr(sys, 'frozen', False):
        # Running as packaged executable
        db_dir = os.path.dirname(sys.executable)
    else:
        # Running as script
        db_dir = os.path.dirname(os.path.dirname(__file__))
    
    # Set database path if needed
    os.environ.setdefault('DB_PATH', os.path.join(db_dir, 'exam.db'))
    
    uvicorn.run(app, host="127.0.0.1", port=port)


