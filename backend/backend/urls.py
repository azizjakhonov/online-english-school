from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


urlpatterns = [
    path('admin/', admin.site.urls),

    # Classroom + lessons APIs (kept for backwards compatibility)
    path('api/classroom/', include('lessons.urls')),
    path('api/lessons/', include('lessons.urls')),

    # Accounts/auth APIs
    path('api/', include('accounts.urls')),
    path('api/accounts/', include('accounts.urls')),

    # Scheduling APIs
    path('api/', include('scheduling.urls')),
    path('api/scheduling/', include('scheduling.urls')),

    # App APIs
    path('api/homework/', include('homework.urls')),
    path('api/progress/', include('progress.urls')),
    path('api/curriculum/', include('curriculum.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/banners/', include('banners.urls')),
    path('api/marketing/', include('marketing.urls')),
    path('api/gamification/', include('gamification.urls')),


    # JWT
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # API docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Silence Chrome DevTools probe
    path(
        '.well-known/appspecific/com.chrome.devtools.json',
        lambda request: HttpResponse(status=204),
        name='chrome_devtools_probe',
    ),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
