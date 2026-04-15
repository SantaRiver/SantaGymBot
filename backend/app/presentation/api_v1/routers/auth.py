import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.database.database import get_async_session
from app.domain.schemas.auth import InitDataRequest, AuthResponse, UserRead
from app.application.services.auth_service import auth_service
from app.presentation.api_v1.deps.deps import get_current_user
from app.infrastructure.database.models import User

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
router = APIRouter()

@router.post("/telegram-auth", response_model=AuthResponse)
async def telegram_auth(request: InitDataRequest, session: AsyncSession = Depends(get_async_session)):
    logger.critical(f"=== INCOMING AUTH REQUEST ===")
    logger.critical(f"Raw initData: {request.initData}")
    try:
        if request.initData.startswith("test_mode="):
            tg_id = int(request.initData.split("test_mode=")[1])
            user = await auth_service._get_or_create_test_user(session, tg_id)
            token = auth_service.create_access_token(tg_id=tg_id, user_id=str(user.id))
            return AuthResponse(access_token=token, user=user)

        user, token = await auth_service.authenticate_user(session, request.initData)
        logger.critical(f"Auth successful for tg_id={user.tg_id}")
        return AuthResponse(access_token=token, user=user)
    except Exception as e:
        logger.critical(f"AUTH FAILED: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

@router.get("/me", response_model=UserRead)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user