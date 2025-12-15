from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import uvicorn
import sys
import os
import logging
from datetime import datetime
from pathlib import Path

# Use relative imports (works when run as a module: python -m uvicorn server.main:app)
from .db import Base, engine
from .routes import files as files_routes
from .routes import concepts as concepts_routes
from .routes import exam as exam_routes
from .routes import dashboard as dashboard_routes
from .routes import classes as classes_routes
from .routes import ai_generation as ai_routes
from .routes import jobs as jobs_routes
from .routes import backup as backup_routes
from .routes import analytics as analytics_routes
from .routes import questions as questions_routes


# Configure logging to file AND console
def setup_logging():
    """
    Configure logging to write to both file and console.
    Captures all logs, errors, and stack traces for debugging.
    """
    # Determine log file path
    # In Docker, use /app/logs, otherwise use the server directory
    if os.getenv("DB_DIR"):  # Docker environment
        log_dir = Path("/app/logs")
    else:
        log_dir = Path(__file__).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "backend.log"
    
    # Create a logger
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)  # Capture everything
    
    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # File handler - writes everything to file with timestamps
    file_handler = logging.FileHandler(log_file, mode='a', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    # Console handler - also write to console (for visible terminals)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '%(levelname)s | %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # Log startup message
    logger.info("=" * 80)
    logger.info(f"Backend logging started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Log file: {log_file.absolute()}")
    logger.info("=" * 80)
    
    return logger


# Initialize logging immediately
logger = setup_logging()


def create_app() -> FastAPI:
    app = FastAPI(title="Hoosier Prep Portal API", version="0.1.0")

    # Custom exception handler for validation errors
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Log detailed validation errors for debugging"""
        logger.error(f"[VALIDATION ERROR] {request.method} {request.url.path}")
        logger.error(f"[VALIDATION ERROR] Errors: {exc.errors()}")
        logger.error(f"[VALIDATION ERROR] Body: {exc.body}", exc_info=True)
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors(), "body": str(exc.body)},
        )

    # CORS for Vite dev server and Docker
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:80",      # Docker nginx
        "http://localhost",          # Docker nginx (no port)
        os.getenv("FRONTEND_URL", ""),  # Environment variable override
    ]
    # Filter out empty strings
    origins = [o for o in origins if o]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],  # Explicitly expose all headers
    )

    # CORS debugging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        origin = request.headers.get("origin", "None")
        logger.info(f"[CORS] {request.method} {request.url.path} | Origin: {origin}")
        try:
            response = await call_next(request)
            cors_header = response.headers.get("access-control-allow-origin", "MISSING")
            logger.info(f"[CORS] Response CORS header: {cors_header} | Status: {response.status_code}")
            return response
        except Exception as e:
            logger.error(f"[CORS] Request failed: {e}", exc_info=True)
            raise

    # Explicitly handle CORS pre-flight OPTIONS requests
    @app.options("/{full_path:path}")
    async def preflight_handler(full_path: str):
        """Handle CORS pre-flight OPTIONS requests"""
        logger.info(f"[CORS] Handling OPTIONS pre-flight for /{full_path}")
        return {}

    # Routers
    app.include_router(files_routes.router, prefix="/api")
    app.include_router(concepts_routes.router, prefix="/api")
    app.include_router(exam_routes.router, prefix="/api")
    app.include_router(dashboard_routes.router, prefix="/api")
    app.include_router(classes_routes.router, prefix="/api")
    app.include_router(ai_routes.router, prefix="/api")
    app.include_router(jobs_routes.router, prefix="/api")
    app.include_router(backup_routes.router, prefix="/api")
    app.include_router(analytics_routes.router, prefix="/api")
    app.include_router(questions_routes.router, prefix="/api")

    @app.on_event("startup")
    def _startup() -> None:
        # Create tables on startup for local dev
        Base.metadata.create_all(bind=engine)

    @app.get("/api/health")
    def health_check():
        """Health check endpoint to verify backend is ready"""
        return {"status": "ok", "service": "Hoosier Prep Portal API"}

    return app


app = create_app()

if __name__ == "__main__":
    # Allow running backend with custom port
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
    
    # Determine database path - use environment variable for Docker, otherwise default
    db_dir = os.getenv("DB_DIR")
    if not db_dir:
        if getattr(sys, 'frozen', False):
            # Running as packaged executable
            db_dir = os.path.dirname(sys.executable)
        else:
            # Running as script
            db_dir = os.path.dirname(os.path.dirname(__file__))
    
    # Ensure directory exists
    os.makedirs(db_dir, exist_ok=True)
    
    # Set database path if needed
    os.environ.setdefault('DB_PATH', os.path.join(db_dir, 'exam.db'))
    
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=port,
        timeout_keep_alive=120,  # 2 minute keep-alive for long file uploads
        limit_concurrency=100,
        limit_max_requests=1000,
    )


