from fastapi import FastAPI
from backend.ai_assessment import AlmaProvider, AssessmentService

from .routes.analysis import router as analysis_router


def create_app(*, retrieval_service=None, assessment_service=None) -> FastAPI:
    app = FastAPI(
        title="BidBridge API",
        description="Advisory, evidence-backed procurement pre-bid readiness assessment.",
        version="0.1.0",
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
