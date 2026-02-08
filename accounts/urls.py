from django.urls import path
from .views import SendOTPView, VerifyOTPView, SelectRoleView
# We import MeView and TeachersListView assuming they still exist in your api.py
# If you deleted them, remove these imports.
from .api import MeView, TeachersListView 
from .api import TeacherDetailView # Import it
urlpatterns = [
    # --- 1. NEW AUTH FLOW (Phone + OTP) ---
    # These match exactly what your React Login component asks for:
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('select-role/', SelectRoleView.as_view(), name='select-role'),
    path('teachers/<int:id>/', TeacherDetailView.as_view(), name='teacher-detail'),
    # --- 2. EXISTING DATA ENDPOINTS ---
    path("me/", MeView.as_view(), name="me"),
    path("teachers/", TeachersListView.as_view(), name="teachers-list"),
]