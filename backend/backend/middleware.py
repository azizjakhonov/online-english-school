# backend/backend/middleware.py

import jwt
from urllib.parse import parse_qs
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware

# 1. Get the User model safely
User = get_user_model()

@database_sync_to_async
def get_user(token_key):
    try:
        # 2. Decode the token using your SECRET_KEY
        payload = jwt.decode(token_key, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get('user_id')
        return User.objects.get(id=user_id)
    except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist):
        return AnonymousUser()

class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # 3. Get the query string (e.g., b'token=abc...')
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        
        # 4. Extract the token
        token = query_params.get("token", [None])[0]
        
        # 5. Attach the user to the scope
        if token:
            scope["user"] = await get_user(token)
        else:
            scope["user"] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)