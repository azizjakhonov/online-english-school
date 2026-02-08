from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # --- AUTH & ACCOUNTS ---
    # This makes endpoints like: /api/send-otp/ and /api/me/
    path("api/", include("accounts.urls")),
    path('api/', include('scheduling.urls')),
    # --- APP ENDPOINTS ---
    # We prefix these to keep them organized
    path("api/lessons/", include("lessons.urls")),
    path("api/scheduling/", include("scheduling.urls")),
    path("api/homework/", include("homework.urls")),
    path("api/progress/", include("progress.urls")),
    path("api/curriculum/", include("curriculum.urls")),
    path("api/curriculum/", include("curriculum.urls")), # New Content API
    path("api/lessons/", include("lessons.urls")),
    # --- JWT TOKENS (Standard) ---
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # --- DOCUMENTATION (Swagger) ---
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

# Media Files (Images/Videos) for Development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)