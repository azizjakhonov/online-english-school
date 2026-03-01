import logging
import uuid
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
import re
import mimetypes
from django.http import FileResponse, StreamingHttpResponse
from django.db.models import Max

from rest_framework import parsers, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

# PDF Generation Tool (used for lesson slide automation)
import pypdfium2 as pdfium

from .models import Course, Unit, Lesson, LessonActivity, PdfAsset, AudioAsset, VideoAsset
from .serializers import (
    CourseSerializer,
    UnitSerializer,
    LessonSerializer,
    LessonActivitySerializer,
    PdfAssetSerializer,
    AudioAssetSerializer,
    VideoAssetSerializer,
)

# ... (rest of the file remains, but I will append the new ViewSet)
# I will use multi_replace for better control if needed, but for now I'll just find the end.
# Wait, I see I should add 're' and 'os' to the top level if not there.


logger = logging.getLogger(__name__)


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    permission_classes = [permissions.IsAuthenticated]


class LessonActivityViewSet(viewsets.ModelViewSet):
    queryset = LessonActivity.objects.all()
    serializer_class = LessonActivitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LessonActivity.objects.all()
        lesson_id = self.request.query_params.get('lesson')
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)
        return queryset


class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.select_related('unit').prefetch_related('activities')
    serializer_class = LessonSerializer
    parser_classes = (parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser)
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        unit_id = self.request.query_params.get('unit')
        search = self.request.query_params.get('q')

        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)
        if search:
            queryset = queryset.filter(title__icontains=search)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lesson = serializer.save()

        # AUTOMATION: If a PDF was uploaded, generate slides as image Activities
        if lesson.slides_pdf:
            try:
                self._generate_activities_from_pdf(lesson)
            except Exception as e:
                print(f"Error generating slides: {e}")
                return Response(
                    {
                        "data": serializer.data,
                        "error": f"Lesson created, but slide generation failed: {str(e)}",
                    },
                    status=status.HTTP_201_CREATED,
                )

        updated_lesson = Lesson.objects.get(id=lesson.id)
        updated_serializer = self.get_serializer(updated_lesson)
        headers = self.get_success_headers(updated_serializer.data)
        return Response(updated_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['put'], url_path='activities')
    def replace_activities(self, request, pk=None):
        lesson = self.get_object()
        payload = request.data if isinstance(request.data, list) else request.data.get('activities')
        if payload is None:
            return Response(
                {'detail': 'Expected a list payload or an object with an "activities" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = LessonActivitySerializer(
            data=payload,
            many=True,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)

        lesson.activities.all().delete()
        new_rows = []
        for idx, activity_data in enumerate(serializer.validated_data, start=1):
            new_rows.append(
                LessonActivity(
                    lesson=lesson,
                    title=activity_data.get('title') or 'New Activity',
                    activity_type=activity_data['activity_type'],
                    order=activity_data.get('order') or idx,
                    content=activity_data.get('content') or {},
                )
            )
        if new_rows:
            LessonActivity.objects.bulk_create(new_rows)

        lesson.refresh_from_db()
        return Response(self.get_serializer(lesson).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        source = self.get_object()
        next_order = (
            Lesson.objects.filter(unit=source.unit).aggregate(max_order=Max('order')).get('max_order') or 0
        ) + 1
        clone = Lesson.objects.create(
            unit=source.unit,
            title=f'{source.title} (Copy)',
            order=next_order,
            description=source.description,
            slides_pdf=source.slides_pdf,
        )

        copied_activities = []
        for activity in source.activities.all().order_by('order'):
            copied_activities.append(
                LessonActivity(
                    lesson=clone,
                    title=activity.title,
                    activity_type=activity.activity_type,
                    order=activity.order,
                    content=activity.content,
                )
            )
        if copied_activities:
            LessonActivity.objects.bulk_create(copied_activities)

        return Response(self.get_serializer(clone).data, status=status.HTTP_201_CREATED)

    def _generate_activities_from_pdf(self, lesson):
        """Convert PDF pages into 'image' LessonActivities (existing feature)."""
        pdf_path = lesson.slides_pdf.path
        pdf = pdfium.PdfDocument(pdf_path)
        activities_to_create = []

        for i, page in enumerate(pdf):
            bitmap = page.render(scale=2)
            pil_image = bitmap.to_pil()
            blob = BytesIO()
            pil_image.save(blob, format='JPEG', quality=85)
            filename = f"lessons/slides/lesson_{lesson.id}_slide_{i + 1}_{uuid.uuid4().hex[:6]}.jpg"
            saved_path = default_storage.save(filename, ContentFile(blob.getvalue()))
            file_url = default_storage.url(saved_path)
            activities_to_create.append(
                LessonActivity(
                    lesson=lesson,
                    title=f"Slide {i + 1}",
                    activity_type='image',
                    order=i + 1,
                    content={"image": file_url},
                )
            )

        LessonActivity.objects.bulk_create(activities_to_create)


class PdfAssetViewSet(viewsets.ModelViewSet):
    """
    CRUD for teacher-uploaded PDF files.

    Endpoints (all under /api/curriculum/pdfs/):
      GET    /api/curriculum/pdfs/               - list teacher's own PDFs
      POST   /api/curriculum/pdfs/               - upload a new PDF (multipart)
      GET    /api/curriculum/pdfs/<id>/          - retrieve metadata
      DELETE /api/curriculum/pdfs/<id>/          - delete
      GET    /api/curriculum/pdfs/<id>/download/ - authenticated download (any JWT user)
    """

    serializer_class = PdfAssetSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        # Teachers only see their own uploads in list/retrieve
        return PdfAsset.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _with_download_cors(self, request, response):
        """Attach explicit CORS headers for PDF download responses."""
        origin = request.headers.get('Origin')
        allowed_origins = set(getattr(settings, 'CORS_ALLOWED_ORIGINS', []))

        if origin and origin in allowed_origins:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
            response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition, Content-Length, Content-Type'
            if getattr(settings, 'CORS_ALLOW_CREDENTIALS', False):
                response['Access-Control-Allow-Credentials'] = 'true'

            vary_header = response.get('Vary', '')
            if 'Origin' not in vary_header:
                response['Vary'] = f'{vary_header}, Origin'.strip(', ')

        return response

    def _log_download(self, request, pdf_id, status_code, reason):
        user_id = request.user.pk if getattr(request.user, 'is_authenticated', False) else None
        logger.info(
            '[PdfDownload] user_id=%s role=%s pdf_id=%s status=%s reason=%s origin=%s',
            user_id,
            getattr(request.user, 'role', None) if user_id else None,
            pdf_id,
            status_code,
            reason,
            request.headers.get('Origin'),
        )

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.AllowAny])
    def download(self, request, pk=None):
        user = request.user
        if not user or not user.is_authenticated:
            token = request.query_params.get('token')
            if token:
                from rest_framework_simplejwt.authentication import JWTAuthentication
                try:
                    validated_token = JWTAuthentication().get_validated_token(token)
                    user = JWTAuthentication().get_user(validated_token)
                except Exception:
                    pass

        if not user or not user.is_authenticated:
            response = Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            return self._with_download_cors(request, response)

        try:
            pdf = PdfAsset.objects.get(pk=pk)
        except PdfAsset.DoesNotExist:
            response = Response(
                {'detail': 'PDF not found (deleted or wrong id).'},
                status=status.HTTP_404_NOT_FOUND,
            )
            self._log_download(request, pk, response.status_code, 'pdf_missing')
            return self._with_download_cors(request, response)

        if pdf.owner_id != user.pk:
            # Non-owners may download only if the PDF is in an active lesson.
            in_use = LessonActivity.objects.filter(
                activity_type='pdf',
                content__pdf_id=pdf.pk,
            ).exists()
            if not in_use:
                response = Response(
                    {'detail': "You don't have access to this PDF."},
                    status=status.HTTP_403_FORBIDDEN,
                )
                self._log_download(request, pdf.pk, response.status_code, 'forbidden_not_in_lesson')
                return self._with_download_cors(request, response)

        if not pdf.file or not pdf.file.name:
            response = Response(
                {'detail': 'No PDF attached to this activity.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
            self._log_download(request, pdf.pk, response.status_code, 'empty_file_field')
            return self._with_download_cors(request, response)

        try:
            f = pdf.file.open('rb')
        except ValueError:
            response = Response(
                {'detail': 'No PDF attached to this activity.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
            self._log_download(request, pdf.pk, response.status_code, 'field_open_value_error')
            return self._with_download_cors(request, response)
        except (FileNotFoundError, OSError):
            response = Response(
                {'detail': 'PDF file missing on server.'},
                status=status.HTTP_410_GONE,
            )
            self._log_download(request, pdf.pk, response.status_code, 'file_missing_on_storage')
            return self._with_download_cors(request, response)

        # Sanitize filename - strip chars that break Content-Disposition headers.
        safe_name = (pdf.title or f'document_{pdf.id}').replace('"', '').replace('\\', '')
        filename = f'{safe_name}.pdf'

        response = FileResponse(f, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition, Content-Length, Content-Type'

        try:
            response['Content-Length'] = str(pdf.file.size)
        except Exception:
            # Storage backends can omit/raise for size metadata; not fatal.
            pass

        self._log_download(request, pdf.pk, response.status_code, 'ok')
        return self._with_download_cors(request, response)

    @action(detail=True, methods=['get'], url_path='preview/(?P<page>[0-9]+)', permission_classes=[permissions.AllowAny])
    def preview(self, request, pk=None, page=1):
        """
        Returns a JPEG render of a specific PDF page.
        Allows authenticated users or those with a valid JWT token in query params.
        """
        user = request.user
        if not user or not user.is_authenticated:
            token = request.query_params.get('token')
            if token:
                from rest_framework_simplejwt.authentication import JWTAuthentication
                try:
                    validated_token = JWTAuthentication().get_validated_token(token)
                    user = JWTAuthentication().get_user(validated_token)
                except Exception:
                    pass

        if not user or not user.is_authenticated:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from django.shortcuts import get_object_or_404
        pdf_asset = get_object_or_404(PdfAsset, pk=pk)
        page_idx = int(page) - 1

        try:
            pdf = pdfium.PdfDocument(pdf_asset.file.path)
            if page_idx < 0 or page_idx >= len(pdf):
                return Response({'error': 'Page out of range'}, status=status.HTTP_400_BAD_REQUEST)

            page_obj = pdf[page_idx]
            bitmap = page_obj.render(scale=2)
            pil_image = bitmap.to_pil()

            response_data = BytesIO()
            pil_image.save(response_data, format='JPEG', quality=85)
            response_data.seek(0)

            return FileResponse(response_data, content_type='image/jpeg')
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AudioAssetViewSet(viewsets.ModelViewSet):
    """
    CRUD for teacher-uploaded Audio files.

    Endpoints (/api/curriculum/audio/):
      GET    /api/curriculum/audio/               - list teacher's own audio
      POST   /api/curriculum/audio/               - upload (multipart)
      GET    /api/curriculum/audio/<id>/          - metadata
      DELETE /api/curriculum/audio/<id>/          - delete
      GET    /api/curriculum/audio/<id>/download/ - authenticated download
    """

    serializer_class = AudioAssetSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        return AudioAsset.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _with_download_cors(self, request, response):
        origin = request.headers.get('Origin')
        # Media streaming requires loose CORS and exposure of Range headers
        if origin:
            response['Access-Control-Allow-Origin'] = origin
        else:
            response['Access-Control-Allow-Origin'] = '*'
            
        response['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, Range'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition, Content-Length, Content-Type, Content-Range, Accept-Ranges'
        
        if getattr(settings, 'CORS_ALLOW_CREDENTIALS', False):
            response['Access-Control-Allow-Credentials'] = 'true'
        
        if origin:
            vary_header = response.get('Vary', '')
            if 'Origin' not in vary_header:
                response['Vary'] = f'{vary_header}, Origin'.strip(', ')
        return response

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.AllowAny])
    def download(self, request, pk=None):
        user = request.user
        if not user or not user.is_authenticated:
            token = request.query_params.get('token')
            if token:
                from rest_framework_simplejwt.authentication import JWTAuthentication
                try:
                    validated_token = JWTAuthentication().get_validated_token(token)
                    user = JWTAuthentication().get_user(validated_token)
                except Exception:
                    pass

        if not user or not user.is_authenticated:
            return self._with_download_cors(request, Response({'detail': 'Authentication required'}, status=401))

        try:
            audio = AudioAsset.objects.get(pk=pk)
        except AudioAsset.DoesNotExist:
            return self._with_download_cors(request, Response({'detail': 'Not found'}, status=404))

        if audio.owner_id != user.pk:
            in_use = LessonActivity.objects.filter(activity_type='listening', content__audio_id=audio.pk).exists()
            # Also check homework activities
            from homework.models import HomeworkActivity
            in_hw = HomeworkActivity.objects.filter(activity_type='listening', content__audio_id=audio.pk).exists()
            
            if not in_use and not in_hw:
                return self._with_download_cors(request, Response({'detail': 'Forbidden'}, status=403))

        if not audio.file:
            return self._with_download_cors(request, Response({'detail': 'No file'}, status=400))

        path = audio.file.path
        file_size = audio.file.size
        # Use mimetypes for accuracy
        content_type, _ = mimetypes.guess_type(path)
        if not content_type:
            content_type = 'audio/mpeg'

        filename = f"audio_{audio.id}.mp3"

        range_header = request.headers.get('Range', None)
        if not range_header:
            f = open(path, 'rb')
            response = FileResponse(f, content_type=content_type)
            response['Accept-Ranges'] = 'bytes'
            response['Content-Length'] = str(file_size)
            response['X-Content-Type-Options'] = 'nosniff'
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return self._with_download_cors(request, response)

        # Handle Range: bytes=start-end
        match = re.search(r'bytes=(\d+)-(\d*)', range_header)
        if not match:
            return self._with_download_cors(request, Response({'detail': 'Invalid range'}, status=416))

        start = int(match.group(1))
        end = match.group(2)
        end = int(end) if end else file_size - 1

        if start >= file_size:
            return self._with_download_cors(request, Response({'detail': 'Range not satisfiable'}, status=416))

        chunk_size = end - start + 1

        def file_iterator(file_path, offset, length):
            with open(file_path, 'rb') as f:
                f.seek(offset)
                remaining = length
                while remaining > 0:
                    read_len = min(remaining, 8192)
                    data = f.read(read_len)
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        response = StreamingHttpResponse(file_iterator(path, start, chunk_size), status=206, content_type=content_type)
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(chunk_size)
        response['Accept-Ranges'] = 'bytes'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return self._with_download_cors(request, response)


class VideoAssetViewSet(viewsets.ModelViewSet):
    """
    CRUD for teacher-uploaded Video files.
    Supports Range requests for seeking on iOS.
    """
    serializer_class = VideoAssetSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        return VideoAsset.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _with_download_cors(self, request, response):
        origin = request.headers.get('Origin')
        if origin:
            response['Access-Control-Allow-Origin'] = origin
        else:
            response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, Range'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition, Content-Length, Content-Type, Content-Range, Accept-Ranges'
        if getattr(settings, 'CORS_ALLOW_CREDENTIALS', False):
            response['Access-Control-Allow-Credentials'] = 'true'
        if origin:
            vary_header = response.get('Vary', '')
            if 'Origin' not in vary_header:
                response['Vary'] = f'{vary_header}, Origin'.strip(', ')
        return response

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.AllowAny])
    def download(self, request, pk=None):
        user = request.user
        if not user or not user.is_authenticated:
            token = request.query_params.get('token')
            if token:
                from rest_framework_simplejwt.authentication import JWTAuthentication
                try:
                    validated_token = JWTAuthentication().get_validated_token(token)
                    user = JWTAuthentication().get_user(validated_token)
                except Exception:
                    pass

        if not user or not user.is_authenticated:
            return self._with_download_cors(request, Response({'detail': 'Authentication required'}, status=401))

        try:
            video = VideoAsset.objects.get(pk=pk)
        except VideoAsset.DoesNotExist:
            return self._with_download_cors(request, Response({'detail': 'Not found'}, status=404))

        if not video.file:
            return self._with_download_cors(request, Response({'detail': 'No file'}, status=400))

        path = video.file.path
        file_size = video.file.size
        # Use mimetypes for accuracy
        content_type, _ = mimetypes.guess_type(path)
        if not content_type:
            content_type = 'video/mp4'

        filename = f"video_{video.id}.mp4"

        range_header = request.headers.get('Range', None)
        if not range_header:
            f = open(path, 'rb')
            response = FileResponse(f, content_type=content_type)
            response['Accept-Ranges'] = 'bytes'
            response['Content-Length'] = str(file_size)
            response['X-Content-Type-Options'] = 'nosniff'
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return self._with_download_cors(request, response)

        # Handle Range: bytes=start-end
        match = re.search(r'bytes=(\d+)-(\d*)', range_header)
        if not match:
            return self._with_download_cors(request, Response({'detail': 'Invalid range'}, status=416))

        start = int(match.group(1))
        end = match.group(2)
        end = int(end) if end else file_size - 1

        if start >= file_size:
            return self._with_download_cors(request, Response({'detail': 'Range not satisfiable'}, status=416))

        chunk_size = end - start + 1

        def file_iterator(file_path, offset, length):
            with open(file_path, 'rb') as f:
                f.seek(offset)
                remaining = length
                while remaining > 0:
                    read_len = min(remaining, 8192)
                    data = f.read(read_len)
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        response = StreamingHttpResponse(file_iterator(path, start, chunk_size), status=206, content_type=content_type)
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(chunk_size)
        response['Accept-Ranges'] = 'bytes'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return self._with_download_cors(request, response)


# ============================================================================
# ENROLLMENT SYSTEM
# ============================================================================
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Enrollment, Course


class EnrollmentListCreateView(APIView):
    """
    GET  /api/curriculum/enrollments/   — student's enrollments
    POST /api/curriculum/enrollments/   — enroll in a course { "course_id": <id> }
    """
    permission_classes = [IsAuthenticated]

    def _get_student(self, user):
        if not hasattr(user, 'student_profile'):
            return None, Response({'error': 'Only students can access enrollments.'}, status=403)
        return user.student_profile, None

    def get(self, request):
        profile, err = self._get_student(request.user)
        if err:
            return err
        enrollments = (
            Enrollment.objects
            .filter(student=profile)
            .select_related('course')
            .order_by('-created_at')
        )
        return Response([
            {
                'id':           e.id,
                'course_id':    e.course.id,
                'course_title': e.course.title,
                'status':       e.status,
                'status_label': e.get_status_display(),
                'started_at':   e.started_at.isoformat() if e.started_at else None,
                'completed_at': e.completed_at.isoformat() if e.completed_at else None,
                'created_at':   e.created_at.isoformat(),
            }
            for e in enrollments
        ])

    def post(self, request):
        profile, err = self._get_student(request.user)
        if err:
            return err

        course_id = request.data.get('course_id')
        course = get_object_or_404(Course, pk=course_id)

        enrollment, created = Enrollment.objects.get_or_create(
            student=profile,
            course=course,
            defaults={'status': Enrollment.Status.ACTIVE},
        )
        return Response(
            {
                'id':           enrollment.id,
                'course_id':    enrollment.course.id,
                'course_title': enrollment.course.title,
                'status':       enrollment.status,
                'started_at':   enrollment.started_at.isoformat() if enrollment.started_at else None,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class EnrollmentUpdateView(APIView):
    """
    PATCH /api/curriculum/enrollments/<id>/   — update status { "status": "COMPLETED"|"DROPPED" }
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not hasattr(request.user, 'student_profile'):
            return Response({'error': 'Only students can update enrollments.'}, status=403)
        profile = request.user.student_profile
        enrollment = get_object_or_404(Enrollment, pk=pk, student=profile)

        new_status = request.data.get('status')
        allowed = [Enrollment.Status.COMPLETED, Enrollment.Status.DROPPED]
        if new_status not in [s.value for s in allowed]:
            return Response({'error': f'Status must be one of: {[s.value for s in allowed]}'}, status=400)

        enrollment.status = new_status
        if new_status == Enrollment.Status.COMPLETED:
            from django.utils import timezone
            enrollment.completed_at = timezone.now()
        enrollment.save()
        return Response({'id': enrollment.id, 'status': enrollment.status})
