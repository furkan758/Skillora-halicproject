"""Run with python -m uvicorn app.main:app --host 127.0.0.1 --port 8000."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, get_settings
from .dependencies import Repository
from .errors import ApiError
from .routers import catalog, employees, scenarios


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    application = FastAPI(
        title="Skillora API", version="1.0.0",
        description="Employee skills and scenario planning using FastAPI and Microsoft SQL Server. All IDs are SQL integer identities. Local classroom presentation; user login is outside the agreed scope.",
    )
    application.dependency_overrides[get_settings] = lambda: settings
    application.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins),
        allow_credentials=False, allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"])

    @application.exception_handler(ApiError)
    async def api_error_handler(request: Request, error: ApiError):
        return JSONResponse(status_code=error.status, content={"code": error.code,
            "message": error.message, **error.details})

    @application.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, error: RequestValidationError):
        details = [{"field": ".".join(str(part) for part in item["loc"]),
                    "message": item["msg"], "type": item["type"]} for item in error.errors()]
        return JSONResponse(status_code=422, content={"code": "validation_error",
            "message": "Check the submitted fields.", "details": details})

    @application.get("/health", tags=["Health"])
    def health():
        return {"status": "ok", "service": "skillora-api"}

    @application.get("/health/ready", tags=["Health"])
    def ready(repo: Repository):
        return repo.ready()

    application.include_router(catalog.router, prefix="/api")
    application.include_router(employees.router, prefix="/api")
    application.include_router(scenarios.router, prefix="/api")
    return application


app = create_app()
