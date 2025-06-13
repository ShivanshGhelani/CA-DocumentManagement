from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, MFASetupSerializer,
    MFAVerifySerializer, UserProfileSerializer, PasswordChangeSerializer
)
from audit.models import AuditLog

User = get_user_model()


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
            # Return temporary token for MFA verification
            return Response({
                'requires_mfa': True,
                'user_id': user.id,
                'message': 'MFA verification required'
            })
        
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
    serializer = MFAVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    user_id = request.data.get('user_id')
    token = serializer.validated_data['token']
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid user'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not user.is_mfa_enabled:
        return Response(
            {'error': 'MFA not enabled for this user'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not user.verify_totp(token):
        return Response(
            {'error': 'Invalid MFA token'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
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
    """Enable MFA for user"""
    serializer = MFAVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    token = serializer.validated_data['token']
    user = request.user
    
    if not user.verify_totp(token):
        return Response(
            {'error': 'Invalid MFA token'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
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
        'message': 'MFA enabled successfully',
        'user': UserProfileSerializer(user).data
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mfa_disable(request):
    """Disable MFA for user"""
    user = request.user
    user.is_mfa_enabled = False
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


class UserProfileView(generics.RetrieveUpdateAPIView):
    """User profile view"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        
        # Log profile update
        AuditLog.log_activity(
            user=request.user,
            action='update',
            resource_type='user',
            resource_id=request.user.id,
            resource_name=request.user.email,
            details={'fields_updated': list(request.data.keys())},
            request=request
        )
        
        return response


class PasswordChangeView(generics.GenericAPIView):
    """Password change view"""
    serializer_class = PasswordChangeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        # Log password change
        AuditLog.log_activity(
            user=user,
            action='update',
            resource_type='user',
            resource_id=user.id,
            resource_name=user.email,
            details={'password_changed': True},
            request=request
        )
        
        return Response({'message': 'Password changed successfully'})


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
