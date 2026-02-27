from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
# 1. Import Parsers
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser 
from .models import Course, Unit, Lesson, LessonActivity
from .serializers import CourseSerializer, UnitSerializer, LessonSerializer, LessonActivitySerializer

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    # 2. Add Parser Classes explicitly to allow JSON
    parser_classes = [JSONParser, MultiPartParser, FormParser] 

    @action(detail=True, methods=['post'])
    def add_activity(self, request, pk=None):
        lesson = self.get_object()
        serializer = LessonActivitySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(lesson=lesson)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LessonActivityViewSet(viewsets.ModelViewSet):
    queryset = LessonActivity.objects.all()
    serializer_class = LessonActivitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    # 3. Add Parser Classes here too
    parser_classes = [JSONParser, MultiPartParser, FormParser]