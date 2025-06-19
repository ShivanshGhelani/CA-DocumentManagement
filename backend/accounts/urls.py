from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication
    path('register/', views.UserRegistrationView.as_view(), name='user-register'),
    path('login/', views.CustomTokenObtainPairView.as_view(), name='user-login'),
    path('logout/', views.logout, name='user-logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),    # MFA
    path('mfa/setup/', views.MFASetupView.as_view(), name='mfa-setup'),
    path('mfa/verify/', views.mfa_verify, name='mfa-verify'),
    path('mfa/enable/', views.mfa_enable, name='mfa-enable'),
    path('mfa/disable/', views.mfa_disable, name='mfa-disable'),
    path('mfa/generate-code/', views.mfa_generate_code, name='mfa-generate-code'),
    path('mfa/backup-codes/generate/', views.mfa_generate_backup_codes, name='mfa-generate-backup-codes'),
    path('mfa/backup-codes/status/', views.mfa_backup_codes_status, name='mfa-backup-codes-status'),
      # Profile
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('password/change/', views.PasswordChangeView.as_view(), name='password-change'),
    path('avatar/upload/', views.AvatarUploadView.as_view(), name='avatar-upload'),
    path('avatar/delete/', views.AvatarDeleteView.as_view(), name='avatar-delete'),
]
