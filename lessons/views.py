from django.shortcuts import render
# Add to imports
from django.shortcuts import render
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Lesson  # <--- THIS WAS MISSING
from .serializers import LessonUpdateSerializer
# ... existing views ...

class AdminLessonUpdateView(generics.UpdateAPIView):
    """
    PUT/PATCH /api/lessons/<pk>/update/
    Allows admin to change time or status of a lesson.
    """
    queryset = Lesson.objects.all()
    serializer_class = LessonUpdateSerializer
    permission_classes = [IsAuthenticated] # In production, use IsAdminUser