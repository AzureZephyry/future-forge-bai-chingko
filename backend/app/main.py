from typing import Sequence

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.ai_assessment import AlmaProvider, AssessmentService

from .routes.analysis import router as analysis_router
from .services.interfaces import AssessmentServiceProtocol, RetrievalService


def create_app(
    *,
    retrieval_service: RetrievalService | None = None,
    assessment_service: AssessmentServiceProtocol | None = None,
    cors_origins: Sequence[str] = ("http://localhost:5173", "http://127.0.0.1:5173"),
) -> FastAPI:
    app = FastAPI(
        title="BidBridge API",
        description="Advisory, evidence-backed procurement pre-bid readiness assessment.",
        version="0.1.0",
    )
    if cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(cors_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
        )
    app.state.retrieval_service = retrieval_service
    # Real inference is the production default. AlmaProvider currently returns
    # an explicit unavailable error until official configuration is supplied.
    app.state.assessment_service = (
        assessment_service
        if assessment_service is not None
        else AssessmentService(AlmaProvider())
    )
    app.include_router(analysis_router)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, str]:
        """Report API process health only; downstream services are not probed."""
        return {"status": "ok"}

    return app


app = create_app()
