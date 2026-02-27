from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# --- IMPORTS ---
from .models import Lesson, Availability 
from .serializers import LessonSerializer, AvailabilitySerializer

# --- 1. AVAILABILITY VIEWSET ---
class AvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Availability.objects.filter(teacher=self.request.user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

# --- 2. LESSON VIEWSET (Booking & Wallet Logic) ---
# --- 2. LESSON VIEWSET (Booking with Simple Credit Logic) ---
# --- 2. LESSON VIEWSET (Debug Version) ---
class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        return Lesson.objects.filter(Q(teacher=user) | Q(student=user))

    def create(self, request, *args, **kwargs):
        print("\n⚡ --- STARTING BOOKING ---") 
        user = request.user
        print(f"👤 User: {user.phone_number}")

        # 1. Check Profile
        if not hasattr(user, 'student_profile'):
             print("❌ Error: User has no student profile")
             return Response({"error": "Only students can book lessons."}, status=status.HTTP_400_BAD_REQUEST)

        profile = user.student_profile
        print(f"💰 Current Balance: {profile.lesson_credits}")

        # 2. Check Balance
        if profile.lesson_credits < 1:
            print("❌ Error: Insufficient credits")
            return Response(
                {"error": "Insufficient credits. Please refill your wallet."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Validate Data
        data = request.data.copy()
        serializer = self.get_serializer(data=data)
        
        # We explicitly check valid here to print errors if it fails
        if not serializer.is_valid():
            print("❌ VALIDATION FAILED:")
            print(serializer.errors)  # <--- CHECK YOUR CONSOLE FOR THIS
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # 4. Save Lesson
        try:
            serializer.save(student=user)
            print("✅ Lesson Saved to Database")
        except Exception as e:
            print(f"❌ Database Error saving lesson: {e}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # 5. SUBTRACT CREDIT (The Fix)
        # We assume the booking succeeded, now we charge
        old_balance = profile.lesson_credits
        profile.lesson_credits = int(old_balance - 1) # Force Integer
        profile.save()
        
        print(f"💸 Charged! Old: {old_balance} -> New: {profile.lesson_credits}")
        print("--------------------------\n")

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

# --- 3. STATUS UPDATE ENDPOINT (Exiting Class) ---
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_lesson_status(request, pk):
    """
    Updates the lesson status and notes when a teacher exits the classroom.
    """
    # 1. Get the lesson using room_sid (UUID)
    lesson = get_object_or_404(Lesson, room_sid=pk)

    # 2. Get data from request
    raw_status = request.data.get('status')
    notes = request.data.get('notes')  # <--- Get the notes from frontend

    # 3. Update Notes (if provided)
    if notes is not None:
        lesson.notes = notes

    # 4. Intelligent Status Mapping
    if raw_status:
        s_lower = raw_status.lower()

        if s_lower == 'completed':
            lesson.status = 'COMPLETED'
        elif s_lower in ['cancelled', 'canceled']:
            lesson.status = 'CANCELLED'
        elif s_lower == 'pending':
            lesson.status = 'PENDING'
        elif s_lower == 'confirmed':
            lesson.status = 'CONFIRMED'
        else:
            # Handle 'student_absent' and 'technical_issues'
            lesson.status = raw_status

    # 5. Mark the end time
    lesson.ended_at = timezone.now()
    
    lesson.save()

    return Response({
        "success": True,
        "status": lesson.status,
        "ended_at": lesson.ended_at,
        "notes_saved": True
    }, status=status.HTTP_200_OK)