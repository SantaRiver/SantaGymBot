from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.database import get_async_session
from app.domain.schemas.auth import InitDataRequest, AuthResponse, UserRead
from app.application.services.auth_service import auth_service
from app.presentation.api_v1.deps.deps import get_current_user
from app.infrastructure.database.models import User

router = APIRouter()

@router.post("/telegram-auth", response_model=AuthResponse)
async def telegram_auth(
    request: InitDataRequest,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Эндпоинт для авторизации через Telegram WebApp.
    Принимает initData, проверяет подпись, создает/обновляет пользователя
    и возвращает JWT для доступа к остальным эндпоинтам.
    """
    try:
        # TODO: Заглушка для локальной разработки, если WEBAPP тестируется вне ТГ
        # В проде убрать эту проверку
        if request.initData.startswith("test_mode="):
            # Bypass for local dev
            tg_id = int(request.initData.split("test_mode=")[1])
            user = await auth_service._get_or_create_test_user(session, tg_id)
            token = auth_service.create_access_token(tg_id=tg_id, user_id=str(user.id))
            return AuthResponse(access_token=token, user=user)

        user, token = await auth_service.authenticate_user(session, request.initData)
        return AuthResponse(access_token=token, user=user)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.get("/me", response_model=UserRead)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Получить информацию о текущем авторизованном пользователе"""
    return current_user
