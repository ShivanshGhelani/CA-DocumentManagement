from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, MFASetupSerializer,
    MFAVerifySerializer, UserProfileSerializer, PasswordChangeSerializer,
    UserDetailSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    MFABackupCodesRequestSerializer
)
from .utils import send_password_reset_email, send_mfa_backup_codes_email
from audit.models import AuditLog
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


# from rest_framework import generics, permissions
from .models import User
from .serializers import UserDetailSerializer

class UserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by('id')
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


class UserRegistrationView(generics.CreateAPIView):
    """User registration endpoint"""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Log registration
        AuditLog.log_activity(
            user=user,
            action='create',
            resource_type='user',
            resource_id=user.id,
            resource_name=user.email,
            request=request
        )
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view with audit logging"""
    
    def post(self, request, *args, **kwargs):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
          # Check if MFA is enabled
        if user.is_mfa_enabled:
            # Generate and send MFA code
            mfa_code = user.generate_mfa_code()
            
            # In a real application, you would send this via SMS/email
            # For now, we'll return it in the response (remove this in production)
            return Response({
                'requires_mfa': True,
                'user_id': user.id,
                'message': 'MFA verification required',
                'mfa_code': mfa_code  # Remove this line in production!
            })
        
        # Set MFA as verified for non-MFA users
        user.mfa_verified = True
        user.save()
        
        # Log successful login
        AuditLog.log_activity(
            user=user,
            action='login',
            resource_type='user',
            resource_id=user.id,
            resource_name=user.email,
            request=request
        )
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'Login successful'
        })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def mfa_verify(request):
    """Verify MFA token and complete login"""
    print(f"MFA verification request data: {request.data}")
    
    serializer = MFAVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    user_id = request.data.get('user_id')
    token = serializer.validated_data['token']
    
    print(f"MFA verification - user_id: {user_id}, token: {token}")
    
    try:
        user = User.objects.get(id=user_id)
        print(f"Found user: {user.email}, is_mfa_enabled: {user.is_mfa_enabled}")
        print(f"User stored MFA code: {user.mfa_code}, expires: {user.mfa_code_expires}")
    except User.DoesNotExist:
        print(f"User not found with id: {user_id}")
        return Response(
            {'error': 'Invalid user'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not user.is_mfa_enabled:
        print("MFA not enabled for user")
        return Response(
            {'error': 'MFA not enabled for this user'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    print(f"Calling verify_mfa_code with token: {token}")
    is_valid = user.verify_mfa_code(token)
    print(f"MFA verification result: {is_valid}")
    
    if not is_valid:
        return Response(
            {'error': 'Invalid or expired MFA code'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set MFA as verified
    user.mfa_verified = True
    user.save()
    
    # Log successful login
    AuditLog.log_activity(
        user=user,
        action='login',
        resource_type='user',
        resource_id=user.id,
        resource_name=user.email,
        details={'mfa_verified': True},
        request=request
    )
    
    # Generate tokens
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'user': UserProfileSerializer(user).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        },
        'message': 'Login successful'
    })


class MFASetupView(generics.RetrieveAPIView):
    """Generate MFA setup QR code"""
    serializer_class = MFASetupSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mfa_enable(request):
    """Enable MFA for user (no verification needed for enabling)"""
    user = request.user
    user.is_mfa_enabled = True
    user.save()
    
    # Log MFA enablement
    AuditLog.log_activity(
        user=user,
        action='update',
        resource_type='user',
        resource_id=user.id,
        resource_name=user.email,
        details={'mfa_enabled': True},
        request=request
    )
    
    return Response({
        'message': 'MFA enabled successfully. You will receive a 6-digit code on your next login.',
        'user': UserProfileSerializer(user).data
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mfa_disable(request):
    """Disable MFA for user"""
    user = request.user
    user.is_mfa_enabled = False
    user.mfa_code = None  # Clear any existing codes
    user.mfa_code_expires = None
    user.save()
    
    # Log MFA disablement
    AuditLog.log_activity(
        user=user,
        action='update',
        resource_type='user',
        resource_id=user.id,
        resource_name=user.email,
        details={'mfa_disabled': True},
        request=request
    )
    
    return Response({
        'message': 'MFA disabled successfully',
        'user': UserProfileSerializer(user).data
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mfa_generate_code(request):
    """Generate a new MFA code for the authenticated user"""
    user = request.user
    
    if not user.is_mfa_enabled:
        return Response(
            {'error': 'MFA is not enabled for this user'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Generate new code
    code = user.generate_mfa_code()
    
    # Log code generation
    AuditLog.log_activity(
        user=user,
        action='generate_mfa_code',
        resource_type='user',
        resource_id=user.id,
        resource_name=user.email,
        details={'code_generated': True},
        request=request
    )
    
    return Response({
        'code': code,
        'expires_at': user.mfa_code_expires.isoformat(),
        'message': 'New MFA code generated successfully'
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mfa_generate_backup_codes(request):
    """Generate backup codes for MFA"""
    user = request.user
    
    if not user.is_mfa_enabled:
        return Response(
            {'error': 'MFA is not enabled for this user'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Generate backup codes
    codes = user.generate_backup_codes()
      # Log backup code generation
    AuditLog.log_activity(
        user=user,
        action='create',
        resource_type='user',
        resource_id=user.id,
        resource_name=user.email,
        details={'action_type': 'generate_backup_codes', 'codes_count': len(codes)},
        request=request
    )
    
    return Response({
        'backup_codes': codes,
        'message': f'{len(codes)} backup codes generated successfully',
        'instructions': 'Save these codes in a secure place. Each code can only be used once.'
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def mfa_backup_codes_status(request):
    """Get the status of backup codes"""
    user = request.user
    
    if not user.is_mfa_enabled:
        return Response(
            {'error': 'MFA is not enabled for this user'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    return Response({
        'total_codes': len(user.mfa_backup_codes) if user.mfa_backup_codes else 0,
        'remaining_codes': len(user.mfa_backup_codes) if user.mfa_backup_codes else 0,
        'has_codes': bool(user.mfa_backup_codes)
    })


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Get and update user profile"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Log profile update
        AuditLog.log_activity(
            user=request.user,
            action='update',
            resource_type='user_profile',
            resource_id=request.user.id,
            resource_name=request.user.email,
            details={'updated_fields': list(request.data.keys())},
            request=request
        )
        
        return Response(serializer.data)


class PasswordChangeView(generics.GenericAPIView):
    """Change user password"""
    serializer_class = PasswordChangeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Log password change
        AuditLog.log_activity(
            user=request.user,
            action='password_change',
            resource_type='user',
            resource_id=request.user.id,
            resource_name=request.user.email,
            request=request
        )
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)


class AvatarUploadView(generics.UpdateAPIView):
    """Upload user avatar"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def patch(self, request, *args, **kwargs):
        if 'avatar' not in request.data:
            return Response(
                {'error': 'No avatar file provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        instance = self.get_object()
        
        # Delete old avatar if it exists
        if instance.avatar:
            instance.avatar.delete()
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
          # Log avatar upload
        AuditLog.log_activity(
            user=request.user,
            action='upload',
            resource_type='user',
            resource_id=request.user.id,
            resource_name=request.user.email,
            details={'action_type': 'avatar_upload'},
            request=request
        )
        
        return Response({
            'message': 'Avatar uploaded successfully',
            'avatar_url': serializer.data.get('avatar_url')
        })


class AvatarDeleteView(generics.GenericAPIView):
    """Delete user avatar"""
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request):
        user = request.user
        
        if user.avatar:
            user.avatar.delete()
            user.save()
              # Log avatar deletion
            AuditLog.log_activity(
                user=request.user,
                action='delete',
                resource_type='user',
                resource_id=request.user.id,
                resource_name=request.user.email,
                details={'action_type': 'avatar_delete'},
                request=request
            )
            
            return Response({'message': 'Avatar deleted successfully'})
        else:
            return Response(
                {'error': 'No avatar to delete'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    """Logout endpoint"""
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass
    
    # Log logout
    AuditLog.log_activity(
        user=request.user,
        action='logout',
        resource_type='user',
        resource_id=request.user.id,
        resource_name=request.user.email,
        request=request
    )
    
    return Response({'message': 'Logout successful'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def password_reset_request(request):
    """Request password reset email"""
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    email = serializer.validated_data['email']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Don't reveal whether user exists or not for security
        return Response({
            'message': 'If an account with this email exists, a password reset link has been sent.'
        })
    
    # Generate password reset token
    reset_token = user.generate_password_reset_token()
    
    # Send password reset email
    email_sent = send_password_reset_email(user, reset_token)
    
    if email_sent:
        # Log password reset request (temporarily disabled for debugging)
        # AuditLog.log_activity(
        #     user=user,
        #     action='password_reset_request',
        #     resource_type='user',
        #     resource_id=user.id,
        #     resource_name=user.email,
        #     request=request
        # )
        
        return Response({
            'message': 'Password reset email sent successfully. Check your email for further instructions.'
        })
    else:
        return Response(
            {'error': 'Failed to send password reset email. Please try again later.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request):
    """Confirm password reset with token"""
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    token = serializer.validated_data['token']
    new_password = serializer.validated_data['new_password']
    email = request.data.get('email')
    
    if not email:
        return Response(
            {'error': 'Email is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid reset token'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Reset password with token verification
    if user.reset_password(new_password, token):
        # Clear MFA verification state on password reset
        user.mfa_verified = False
        user.save()
        
        # Log password reset
        AuditLog.log_activity(
            user=user,
            action='password_reset',
            resource_type='user',
            resource_id=user.id,
            resource_name=user.email,
            request=request
        )
        
        return Response({
            'message': 'Password reset successful. You can now login with your new password.'
        })
    else:
        return Response(
            {'error': 'Invalid or expired reset token'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def mfa_request_backup_codes(request):
    """Request new MFA backup codes via email"""
    serializer = MFABackupCodesRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    email = serializer.validated_data['email']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Don't reveal whether user exists or not for security
        return Response({
            'message': 'If an account with this email exists and has MFA enabled, new backup codes have been sent.'
        })
    
    # Check if user has MFA enabled
    if not user.is_mfa_enabled:
        return Response({
            'error': 'MFA is not enabled for this account.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate new backup codes
    backup_codes = user.generate_backup_codes()
    
    # Send backup codes email
    email_sent = send_mfa_backup_codes_email(user, backup_codes)
    
    if email_sent:
        # Log backup codes request (temporarily disabled for debugging)
        # AuditLog.log_activity(
        #     user=user,
        #     action='mfa_backup_codes_request',
        #     resource_type='user',
        #     resource_id=user.id,
        #     resource_name=user.email,
        #     details={'codes_count': len(backup_codes)},
        #     request=request
        # )
        
        return Response({
            'message': f'New backup codes generated and sent to your email. You now have {len(backup_codes)} backup codes.'
        })
    else:
        return Response(
            {'error': 'Failed to send backup codes email. Please try again later.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



