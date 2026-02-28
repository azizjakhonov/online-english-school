from django.shortcuts import render
# Add to imports
from django.shortcuts import render
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Lesson  # <--- THIS WAS MISSING
from .serializers import LessonUpdateSerializer
# ... existing views ...
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from curriculum.models import Lesson
from curriculum.serializers import LessonSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from curriculum.models import Lesson
from curriculum.serializers import LessonSerializer

class AdminLessonUpdateView(generics.UpdateAPIView):
    """
    PUT/PATCH /api/lessons/<pk>/update/
    Allows admin to change time or status of a lesson.
    """
    queryset = Lesson.objects.all()
    serializer_class = LessonUpdateSerializer
    permission_classes = [IsAuthenticated] # In production, use IsAdminUser

class ClassroomEntryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        lesson = get_object_or_404(Lesson, pk=pk)
        role = 'teacher' if request.user.is_staff else 'student'
        serializer = LessonSerializer(lesson, context={'request': request})
        
        # --- THIS IS WHAT YOU WERE MISSING ---
        agora_data = {
            "token": "test_token_placeholder", 
            "appId": "test_app_id",
            "channel": f"lesson_{lesson.id}",
            "uid": request.user.id
        }

        return Response({
            "role": role,
            "lesson": serializer.data,
            "agora": agora_data 
        })