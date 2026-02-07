from django.contrib.auth import get_user_model
from django.db import IntegrityError

from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import TeacherProfile
from django.db import models

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)

    full_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Roles.choices)


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Body:
    {
      "username": "student2",
      "email": "student2@example.com",
      "password": "test12345",
      "full_name": "Student Two",
      "role": "STUDENT"
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        try:
            user = User(
                username=data["username"],
                email=data["email"],
                role=data["role"],
                full_name=data.get("full_name", ""),
                is_active=True,
            )
            user.set_password(data["password"])
            user.save()
        except IntegrityError:
            # likely username or email uniqueness conflict
            return Response(
                {"detail": "Username or email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "detail": "User registered.",
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
            },
            status=status.HTTP_201_CREATED,
        )


class MeSerializer(serializers.ModelSerializer):
    teacher_profile = serializers.SerializerMethodField()
    student_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "full_name", "teacher_profile", "student_profile", "created_at"]

    def get_teacher_profile(self, obj):
        if hasattr(obj, "teacher_profile"):
            p = obj.teacher_profile
            return {
                "id": p.id,
                "bio": p.bio,
                "timezone": p.timezone,
                "is_accepting_students": p.is_accepting_students,
                "created_at": p.created_at,
            }
        return None

    def get_student_profile(self, obj):
        if hasattr(obj, "student_profile"):
            p = obj.student_profile
            return {
                "id": p.id,
                "level": p.level,
                "timezone": p.timezone,
                "goals": p.goals,
                "created_at": p.created_at,
            }
        return None


class MeView(APIView):
    """
    GET /api/me/
    Returns info about the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)
class TeacherListSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = TeacherProfile
        fields = [
            "id",
            "username",
            "full_name",
            "bio",
            "timezone",
            "is_accepting_students",
            "created_at",
        ]


class TeachersListView(APIView):
    """
    GET /api/teachers/
    Student-only. Returns list of teachers.

    Optional filters:
    - ?accepting=true/false
    - ?q=search (matches username/full_name)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Roles.STUDENT:
            raise ValidationError({"detail": "Only students can browse teachers."})

        qs = TeacherProfile.objects.select_related("user").order_by("-created_at")

        accepting = request.query_params.get("accepting")
        if accepting and accepting.lower() in ("1", "true", "yes"):
            qs = qs.filter(is_accepting_students=True)
        elif accepting and accepting.lower() in ("0", "false", "no"):
            qs = qs.filter(is_accepting_students=False)

        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                models.Q(user__username__icontains=q) |
                models.Q(user__full_name__icontains=q)
            )

        return Response(TeacherListSerializer(qs, many=True).data)
