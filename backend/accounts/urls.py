from django.urls import path
from .views import SendOTPView, VerifyOTPView, SelectRoleView
from .api import MeView, TeachersListView, GoogleAuthView
from .api import TeacherDetailView
from .api import TeacherEarningsSummaryView, TeacherEarningsHistoryView
from .api import StudentProfileView, TeacherSettingsView
from .api import (
    ConnectedAccountListView,
    AdminTeacherListView, AdminTeacherApproveView, AdminTeacherDeactivateView,
    TeacherRatingsView,
    SubjectListView, TeacherSubjectView, TeacherSubjectDeleteView,
    TeacherPayoutListCreateView,
)
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

    # --- TEACHERS (public) ---
    path('teachers/',                          TeachersListView.as_view(),   name='teachers-list'),
    path('teachers/<int:id>/',                 TeacherDetailView.as_view(),  name='teacher-detail'),
    path('teachers/<int:teacher_id>/ratings/', TeacherRatingsView.as_view(), name='teacher-ratings'),

    # --- EARNINGS (teacher-only) ---
    path('earnings/summary/', TeacherEarningsSummaryView.as_view(), name='earnings-summary'),
    path('earnings/history/', TeacherEarningsHistoryView.as_view(), name='earnings-history'),
    path('teacher/settings/', TeacherSettingsView.as_view(),        name='teacher-settings'),

    # --- CONNECTED ACCOUNTS ---
    path('connected-accounts/', ConnectedAccountListView.as_view(), name='connected-accounts'),

    # --- ADMIN: TEACHER MANAGEMENT ---
    path('admin/teachers/',                              AdminTeacherListView.as_view(),       name='admin-teachers-list'),
    path('admin/teachers/<int:teacher_id>/approve/',     AdminTeacherApproveView.as_view(),    name='admin-teacher-approve'),
    path('admin/teachers/<int:teacher_id>/deactivate/',  AdminTeacherDeactivateView.as_view(), name='admin-teacher-deactivate'),

    # --- CREDITS (legacy) ---
    path('student/add-credits/', AddCreditsView.as_view(),          name='add-credits'),
    path('add-credits/',         AddCreditsView.as_view(),          name='add-credits-alt'),
    path('mock-purchase/',       MockPurchaseCreditsView.as_view(), name='mock-purchase'),

    # --- SUBJECTS (normalized) ---
    path('subjects/',                   SubjectListView.as_view(),         name='subject-list'),
    path('teacher-subjects/',           TeacherSubjectView.as_view(),      name='teacher-subject-list'),
    path('teacher-subjects/<int:pk>/',  TeacherSubjectDeleteView.as_view(), name='teacher-subject-delete'),

    # --- TEACHER PAYOUTS ---
    path('payouts/', TeacherPayoutListCreateView.as_view(), name='teacher-payouts'),
]


