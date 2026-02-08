import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Lesson # ✅ Ensure this matches your model location

class WhiteboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['lesson_id']
        self.room_group_name = f'lesson_{self.room_name}'
        self.user = self.scope["user"]

        # 1. IMMEDIATE REJECTION FOR ANONYMOUS
        if self.user.is_anonymous:
            await self.close()
            return

        # 2. DATABASE AUTHORIZATION CHECK
        # This prevents User A from entering User B's lesson
        is_authorized = await self.check_lesson_access()
        
        if not is_authorized:
            print(f"SECURITY ALERT: {self.user} blocked from Lesson {self.room_name}")
            await self.close() # 🔒 Kicks the user out immediately
            return

        # 3. ONLY ACCEPT IF AUTHORIZED
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    @database_sync_to_async
    def check_lesson_access(self):
        try:
            # Look for the lesson and verify the user is the teacher or student
            lesson = Lesson.objects.get(id=self.room_name)
            return self.user.id == lesson.teacher_id or self.user.id == lesson.student_id
        except Lesson.DoesNotExist:
            return False