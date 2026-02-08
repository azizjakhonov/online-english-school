from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .models import PhoneOTP
from .utils import generate_otp

User = get_user_model()

class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        if not phone:
            return Response({'error': 'Phone number is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate OTP
        otp = generate_otp()
        
        # Save to DB (Create or Update)
        PhoneOTP.objects.update_or_create(
            phone_number=phone,
            defaults={'otp': otp}
        )

        # TODO: In production, integrate SMS API (Twilio/Eskiz) here.
        # For development, we print to console.
        print(f"########## OTP FOR {phone}: {otp} ##########")

        return Response({'message': 'OTP sent successfully'})


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        code = request.data.get('code')

        # 1. Check OTP
        try:
            otp_record = PhoneOTP.objects.get(phone_number=phone)
        except PhoneOTP.DoesNotExist:
            return Response({'error': 'Invalid phone number'}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.otp != code:
            return Response({'error': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Get or Create User
        user, created = User.objects.get_or_create(phone_number=phone)
        
        # 3. Generate Tokens
        refresh = RefreshToken.for_user(user)
        
        # 4. Check if setup needed
        is_new = created or user.role == 'NEW' or not user.full_name

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'role': user.role,
            'is_new_user': is_new
        })


class SelectRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role = request.data.get('role') # 'student' or 'teacher'
        full_name = request.data.get('full_name')

        if role not in ['student', 'teacher']:
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.full_name = full_name
        
        # Update Role (Case insensitive mapping)
        if role == 'student':
            user.role = User.Roles.STUDENT
        elif role == 'teacher':
            user.role = User.Roles.TEACHER
        
        user.save()
        
        # Signal will automatically create Profile
        return Response({'message': 'Setup complete'})