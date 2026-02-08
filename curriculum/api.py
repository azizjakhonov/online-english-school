import os
import uuid
from io import BytesIO
from django.core.files.base import ContentFile
from rest_framework import viewsets, serializers, parsers, status
from rest_framework.response import Response

# --- NEW: Use pypdfium2 instead of pdf2image ---
import pypdfium2 as pdfium 

from .models import Course, Unit, Lesson, Slide

# --- SERIALIZERS ---

class SlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slide
        fields = ['id', 'image', 'order']

class LessonSerializer(serializers.ModelSerializer):
    slides = SlideSerializer(many=True, read_only=True)
    
    class Meta:
        model = Lesson
        fields = ['id', 'unit', 'title', 'order', 'video_url', 'slides_pdf', 'slides', 'created_at']
        read_only_fields = ['slides']

class UnitSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    class Meta:
        model = Unit
        fields = '__all__'

class CourseSerializer(serializers.ModelSerializer):
    units = UnitSerializer(many=True, read_only=True)
    class Meta:
        model = Course
        fields = '__all__'

# --- VIEWSETS ---

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer

class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    parser_classes = (parsers.MultiPartParser, parsers.FormParser)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lesson = serializer.save()

        # AUTOMATION: If a PDF was uploaded, generate slides
        if lesson.slides_pdf:
            try:
                self._generate_slides_from_pdf(lesson)
            except Exception as e:
                # If generation fails, we still return the lesson created, 
                # but with an error message in the response.
                print(f"Error generating slides: {e}")
                return Response(
                    {"data": serializer.data, "error": f"Lesson created, but slide generation failed: {str(e)}"},
                    status=status.HTTP_201_CREATED
                )

        # Re-fetch the lesson to include the newly generated slides in the response
        updated_lesson = Lesson.objects.get(id=lesson.id)
        updated_serializer = self.get_serializer(updated_lesson)
        
        headers = self.get_success_headers(updated_serializer.data)
        return Response(updated_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _generate_slides_from_pdf(self, lesson):
        """
        Helper function to convert PDF pages into Slide images using pypdfium2.
        No external system dependencies (Poppler) required.
        """
        pdf_path = lesson.slides_pdf.path
        
        # 1. Load the PDF using pypdfium2
        pdf = pdfium.PdfDocument(pdf_path)

        slides_to_create = []

        # 2. Loop through every page
        for i, page in enumerate(pdf):
            # Render the page to an image
            # scale=2 gives good quality (roughly 150 DPI)
            bitmap = page.render(scale=2) 
            pil_image = bitmap.to_pil()   # Convert to Python Pillow Image
            
            # Save image to in-memory file (BytesIO)
            blob = BytesIO()
            pil_image.save(blob, format='JPEG', quality=85)
            
            # Create a unique filename for the image
            filename = f"lesson_{lesson.id}_slide_{i + 1}_{uuid.uuid4().hex[:6]}.jpg"
            
            # Create the Slide object in memory
            slide = Slide(lesson=lesson, order=i + 1)
            
            # Save the image content to the slide
            slide.image.save(filename, ContentFile(blob.getvalue()), save=False)
            
            slides_to_create.append(slide)

        # 3. Bulk create all slides in the database at once for speed
        Slide.objects.bulk_create(slides_to_create)