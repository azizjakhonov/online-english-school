from django.urls import path
from .views import SendOTPView, VerifyOTPView, SelectRoleView
from .api import MeView, TeachersListView, GoogleAuthView
from .api import TeacherDetailView
from .api import TeacherEarningsSummaryView, TeacherEarningsHistoryView
from .api import StudentProfileView, TeacherSettingsView
from .views import AddCreditsView, MockPurchaseCreditsView, AvatarUploadView

urlpatterns = [
    # --- AUTH (Phone + OTP) ---
    path('send-otp/',    SendOTPView.as_view(),    name='send-otp'),
    path('verify-otp/',  VerifyOTPView.as_view(),  name='verify-otp'),
    path('select-role/', SelectRoleView.as_view(), name='select-role'),

    # --- AUTH (Social) ---
    path('auth/google/', GoogleAuthView.as_view(), name='google-auth'),

    # --- PROFILE ---
    path('me/',          MeView.as_view(),          name='me'),
    path('avatar/',      AvatarUploadView.as_view(), name='avatar-upload'),

    # --- STUDENT ---
    path('student/profile/', StudentProfileView.as_view(), name='student-profile'),

    # --- TEACHERS ---
    path('teachers/',           TeachersListView.as_view(), name='teachers-list'),
    path('teachers/<int:id>/',  TeacherDetailView.as_view(), name='teacher-detail'),

    # --- EARNINGS (teacher-only) ---
    path('earnings/summary/', TeacherEarningsSummaryView.as_view(), name='earnings-summary'),
    path('earnings/history/', TeacherEarningsHistoryView.as_view(), name='earnings-history'),
    path('teacher/settings/', TeacherSettingsView.as_view(),        name='teacher-settings'),

    # --- CREDITS (legacy) ---
    path('student/add-credits/', AddCreditsView.as_view(),          name='add-credits'),
    path('add-credits/',         AddCreditsView.as_view(),          name='add-credits-alt'),
    path('mock-purchase/',       MockPurchaseCreditsView.as_view(), name='mock-purchase'),
]


