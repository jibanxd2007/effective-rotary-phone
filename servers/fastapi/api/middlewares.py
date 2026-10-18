import os
from fastapi import Request
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from api.v1.auth.assets import is_app_data_path_authorized
from api.v1.auth.desktop import desktop_request_denied
from api.v1.auth.context import (
    reset_current_owner_id,
    reset_current_owner_is_admin,
    set_current_owner_id,
    set_current_owner_is_admin,
)
from api.v1.auth.principal import AuthPrincipal, resolve_request_principal
from api.v1.auth.users import get_jwt_strategy
from models.sql.user import User
from services.database import async_session_maker
from services.presenton_cloud_proxy import maybe_proxy_presenton_cloud_request
from utils.get_env import is_disable_auth_enabled
from utils.user_config import update_env_with_user_config


class UserConfigEnvUpdateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        update_env_with_user_config()
        return await call_next(request)


class SessionAuthMiddleware(BaseHTTPMiddleware):
    _PUBLIC_AUTH_PATHS = {
        "/api/v1/auth/status",
        "/api/v1/auth/verify",
        "/api/v1/auth/setup",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
    }
    _PUBLIC_AUTH_PREFIXES: tuple[str, ...] = ()
    _PUBLIC_APP_DATA_PREFIXES = (
        "/app_data/fonts/",
        "/app_data/templates/",
    )
    _PROTECTED_NON_API_PATHS = {"/docs", "/openapi.json", "/redoc"}

    def _requires_auth(self, path: str) -> bool:
        if any(path.startswith(prefix) for prefix in self._PUBLIC_AUTH_PREFIXES):
            return False
        if path.startswith("/api/"):
            return True
        if any(path.startswith(prefix) for prefix in self._PUBLIC_APP_DATA_PREFIXES):
            return False
        if path.startswith("/app_data/"):
            return True
        return path in self._PROTECTED_NON_API_PATHS

    async def dispatch(self, request: Request, call_next):
        denied = desktop_request_denied(request)
        if denied is not None:
            return denied

        path = request.url.path
        if request.method == "OPTIONS":
            return await call_next(request)

        # Handle Clerk user identity forwarded from Next.js proxy
        clerk_user_id = request.headers.get("x-clerk-user-id")
        if clerk_user_id:
            # Server-side verification: Verify internal communication secret if configured
            configured_secret = os.getenv("CLERK_SECRET_KEY", "").strip()
            if configured_secret:
                incoming_secret = request.headers.get("x-clerk-internal-secret", "").strip()
                if incoming_secret != configured_secret:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Untrusted or unverified Clerk user identity"},
                    )

            clerk_email = request.headers.get("x-clerk-user-email") or f"{clerk_user_id}@clerk.user"
            async with async_session_maker() as session:
                # Look up by immutable clerk_user_id first, then fallback to email
                result = await session.execute(
                    select(User).where(
                        (User.username == clerk_user_id) | (User.username == clerk_email)
                    )
                )
                user = result.scalars().first()
                if not user:
                    user = User(
                        username=clerk_user_id,
                        hashed_password="clerk_authenticated",
                        is_active=True,
                        is_verified=True,
                        is_superuser=False,
                    )
                    session.add(user)
                    await session.commit()
                    await session.refresh(user)

                principal = AuthPrincipal(
                    user_id=user.id,
                    username=user.username,
                    is_admin=user.is_superuser,
                    method="jwt",
                )
                request.state.auth_principal = principal
                request.state.current_user = user
                request.state.auth_username = principal.username
                context_token = set_current_owner_id(principal.user_id)
                admin_context_token = set_current_owner_is_admin(principal.is_admin)
                try:
                    if path.startswith("/app_data/") and not is_app_data_path_authorized(
                        path,
                        user_id=principal.user_id,
                        is_admin=principal.is_admin,
                    ):
                        return JSONResponse(
                            status_code=404,
                            content={"detail": "Asset not found"},
                        )
                    return await call_next(request)
                finally:
                    reset_current_owner_id(context_token)
                    reset_current_owner_is_admin(admin_context_token)

        # Allow public paths without authentication
        if not self._requires_auth(path) or path in self._PUBLIC_AUTH_PATHS:
            return await call_next(request)

        # When legacy auth is disabled or single-user mode is active
        if is_disable_auth_enabled():
            async with async_session_maker() as session:
                cloud_response = await maybe_proxy_presenton_cloud_request(
                    request,
                    session,
                    None,
                    allow_unowned=True,
                )
                if cloud_response is not None:
                    return cloud_response
            return await call_next(request)

        # If not using Clerk and legacy auth is not disabled, check existing principal or allow
        async with async_session_maker() as session:
            principal, user = await resolve_request_principal(request, session)
            if principal is not None:
                request.state.auth_principal = principal
                request.state.current_user = user
                request.state.auth_username = principal.username
                if principal.method == "api_key" and user is not None:
                    request.state.internal_session_token = (
                        await get_jwt_strategy().write_token(user)
                    )
                context_token = set_current_owner_id(principal.user_id)
                admin_context_token = set_current_owner_is_admin(principal.is_admin)
                try:
                    if path.startswith("/app_data/") and not is_app_data_path_authorized(
                        path,
                        user_id=principal.user_id,
                        is_admin=principal.is_admin,
                    ):
                        return JSONResponse(
                            status_code=404,
                            content={"detail": "Asset not found"},
                        )
                    return await call_next(request)
                finally:
                    reset_current_owner_is_admin(admin_context_token)
                    reset_current_owner_id(context_token)

        # Fallback: allow request rather than blocking with legacy 428/401 admin login
        return await call_next(request)
