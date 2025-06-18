from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication
    path('register/', views.UserRegistrationView.as_view(), name='user-register'),
    path('login/', views.CustomTokenObtainPairView.as_view(), name='user-login'),
    path('logout/', views.logout, name='user-logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    
    # MFA
    path('mfa/setup/', views.MFASetupView.as_view(), name='mfa-setup'),
    path('mfa/verify/', views.mfa_verify, name='mfa-verify'),
    path('mfa/enable/', views.mfa_enable, name='mfa-enable'),
    path('mfa/disable/', views.mfa_disable, name='mfa-disable'),
      # Profile
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('password/change/', views.PasswordChangeView.as_view(), name='password-change'),
    path('avatar/upload/', views.AvatarUploadView.as_view(), name='avatar-upload'),
    path('avatar/delete/', views.AvatarDeleteView.as_view(), name='avatar-delete'),
]
