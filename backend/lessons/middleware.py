# backend/lessons/middleware.py
from django.contrib.auth.models import User
from channels.db import database_sync_to_async
from urllib.parse import parse_qs

class QueryAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Extract token from the URL query string: ws://...?token=USERNAME
        query_params = parse_qs(scope["query_string"].decode())
        token = query_params.get("token", [None])[0]

        if token:
            scope["user"] = await self.get_user(token)
        
        return await self.app(scope, receive, send)

    @database_sync_to_async
    def get_user(self, username):
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            from django.contrib.auth.models import AnonymousUser
            return AnonymousUser()