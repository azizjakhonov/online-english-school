import random
from rest_framework import generics, serializers, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db import models

# Local imports
from .models import TeacherProfile, StudentProfile, PhoneOTP

User = get_user_model()

# ==========================================
# 1. SERIALIZERS
# ==========================================

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'phone_number', 'full_name', 'role', 'date_joined']

class TeacherProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = TeacherProfile
        fields = ['id', 'user', 'bio', 'headline', 'youtube_intro_url', 
                  'hourly_rate', 'rating', 'lessons_taught', 
                  'is_accepting_students']

class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StudentProfile
        fields = ['id', 'user', 'level', 'lesson_credits', 'goals']

class MeSerializer(serializers.ModelSerializer):
    """
    Serializer for the current user (combines User + Profile data)
    """
    teacher_profile = TeacherProfileSerializer(read_only=True)
    student_profile = StudentProfileSerializer(read_only=True)

    class Meta:
        model = User
        # FIXED: Changed 'created_at' to 'date_joined' to match Django defaults
        fields = ["id", "phone_number", "email", "role", "full_name", 
                  "teacher_profile", "student_profile", "date_joined"]


# ==========================================
# 2. AUTHENTICATION VIEWS (OTP)
# ==========================================

class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        if not phone:
            return Response({'error': 'Phone number is required'}, status=400)

        # Generate 5-digit code
        otp = str(random.randint(10000, 99999))
        
        # Save to DB (Persistent & Safer than cache)
        PhoneOTP.objects.update_or_create(
            phone_number=phone,
            defaults={'otp': otp}
        )

        print(f"\n🔥🔥🔥 [DEBUG] OTP for {phone}: {otp} 🔥🔥🔥\n")
        return Response({'message': 'OTP sent successfully'})


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        code = request.data.get('code')

        # 1. Verify OTP
        try:
            record = PhoneOTP.objects.get(phone_number=phone)
            if record.otp != str(code):
                return Response({'error': 'Invalid code'}, status=400)
        except PhoneOTP.DoesNotExist:
            return Response({'error': 'Invalid phone number'}, status=400)

        # 2. Get or Create User
        user, created = User.objects.get_or_create(phone_number=phone)
        if created:
            user.set_unusable_password()
            user.save()

        # 3. Generate Tokens
        refresh = RefreshToken.for_user(user)
        
        # 4. Check if setup is needed
        is_new = created or user.role == 'NEW' or not user.full_name

        # Clear OTP after success
        record.delete()

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'role': user.role,
            'is_new_user': is_new
        })


class SelectRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role = request.data.get('role')
        full_name = request.data.get('full_name')

        if role not in ['student', 'teacher']:
            return Response({'error': 'Invalid role'}, status=400)

        user = request.user
        user.full_name = full_name
        
        if role == 'student':
            user.role = User.Roles.STUDENT
            StudentProfile.objects.get_or_create(user=user)
        elif role == 'teacher':
            user.role = User.Roles.TEACHER
            TeacherProfile.objects.get_or_create(user=user)
        
        user.save()
        return Response({'message': 'Setup complete'})


# ==========================================
# 3. DATA VIEWS
# ==========================================

class MeView(APIView):
    """
    GET: Returns current user data.
    PATCH: Updates user profile (bio, photo, etc).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        data = request.data
        
        # 1. Update Basic Info
        if "full_name" in data:
            user.full_name = data["full_name"]
        if "email" in data:
            user.email = data["email"]
        user.save()

        # 2. Update Teacher Profile
        if user.role == User.Roles.TEACHER:
            profile, _ = TeacherProfile.objects.get_or_create(user=user)
            if "bio" in data: profile.bio = data["bio"]
            if "headline" in data: profile.headline = data["headline"]
            if "hourly_rate" in data: profile.hourly_rate = data["hourly_rate"]
            if "youtube_intro_url" in data: profile.youtube_intro_url = data["youtube_intro_url"]
            profile.save()

        # 3. Update Student Profile
        if user.role == User.Roles.STUDENT:
            profile, _ = StudentProfile.objects.get_or_create(user=user)
            if "goals" in data: profile.goals = data["goals"]
            if "level" in data: profile.level = data["level"]
            profile.save()

        return Response({"detail": "Profile updated."})
class TeacherDetailView(generics.RetrieveAPIView):
    queryset = TeacherProfile.objects.all()
    serializer_class = TeacherProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'

class TeachersListView(generics.ListAPIView):
    """
    Public list of teachers with filtering.
    """
    serializer_class = TeacherProfileSerializer
    permission_classes = [AllowAny] # Changed to AllowAny so guests can see teachers

    def get_queryset(self):
        queryset = TeacherProfile.objects.all().order_by('-rating')
        
        # Search Filter
        q = self.request.query_params.get('q')
        if q:
            queryset = queryset.filter(
                models.Q(user__full_name__icontains=q) | 
                models.Q(headline__icontains=q)
            )
            
        return queryset