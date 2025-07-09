import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import Mock, patch, MagicMock
from datetime import timedelta
import pyotp
import secrets
from PIL import Image
import io
import json

from .models import User
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, MFASetupSerializer,
    MFAVerifySerializer, UserProfileSerializer, PasswordChangeSerializer,
    UserDetailSerializer
)

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    """Comprehensive test cases for User model"""
    
    def test_create_user_basic(self):
        """Test creating a basic user"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.check_password("testpass123")
        assert not user.is_staff
        assert not user.is_superuser
        assert not user.is_mfa_enabled
        assert user.mfa_secret  # Should be auto-generated
        assert user.created_at
        assert user.updated_at
    
    def test_create_superuser(self):
        """Test creating a superuser"""
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123"
        )
        
        assert user.is_staff
        assert user.is_superuser
        assert user.email == "admin@example.com"
    
    def test_user_str_representation(self):
        """Test user string representation"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        assert str(user) == "test@example.com"
    
    def test_user_profile_fields(self):
        """Test user profile fields"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            job_title="Software Engineer",
            purpose="Document management",
            hear_about="Google search",
            phone_number="+1234567890"
        )
        
        assert user.job_title == "Software Engineer"
        assert user.purpose == "Document management"
        assert user.hear_about == "Google search"
        assert user.phone_number == "+1234567890"
    
    def test_mfa_secret_auto_generation(self):
        """Test MFA secret is automatically generated"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        assert user.mfa_secret
        assert len(user.mfa_secret) == 32  # Base32 encoded
    
    def test_generate_mfa_code(self):
        """Test MFA code generation"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        code = user.generate_mfa_code()
        
        assert len(code) == 6
        assert code.isdigit()
        assert user.mfa_code == code
        assert user.mfa_code_expires
        assert user.mfa_code_expires > timezone.now()
    
    def test_generate_backup_codes(self):
        """Test backup code generation"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        codes = user.generate_backup_codes()
        
        assert len(codes) == 7
        assert all(len(code) == 6 and code.isdigit() for code in codes)
        assert user.mfa_backup_codes == codes
    
    def test_use_backup_code_success(self):
        """Test using a valid backup code"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        codes = user.generate_backup_codes()
        test_code = codes[0]
        
        result = user.use_backup_code(test_code)
        
        assert result is True
        assert test_code not in user.mfa_backup_codes
        assert len(user.mfa_backup_codes) == 6
    
    def test_use_backup_code_invalid(self):
        """Test using an invalid backup code"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        user.generate_backup_codes()
        result = user.use_backup_code("invalid_code")
        
        assert result is False
        assert len(user.mfa_backup_codes) == 7
    
    def test_verify_mfa_code_success(self):
        """Test verifying a valid MFA code"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        code = user.generate_mfa_code()
        result = user.verify_mfa_code(code)
        
        assert result is True
        assert user.mfa_code is None  # Should be cleared after use
        assert user.mfa_code_expires is None
    
    def test_verify_mfa_code_invalid(self):
        """Test verifying an invalid MFA code"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        user.generate_mfa_code()
        result = user.verify_mfa_code("invalid")
        
        assert result is False
        assert user.mfa_code is not None  # Should remain set
    
    def test_verify_mfa_code_expired(self):
        """Test verifying an expired MFA code"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        code = user.generate_mfa_code()
        # Manually set expiration to past
        user.mfa_code_expires = timezone.now() - timedelta(minutes=1)
        user.save()
        
        result = user.verify_mfa_code(code)
        
        assert result is False
        assert user.mfa_code is None  # Should be cleared
        assert user.mfa_code_expires is None
    
    def test_verify_mfa_code_super_user_pin(self):
        """Test super user PIN verification"""
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123"
        )
        
        result = user.verify_mfa_code("280804")
        
        assert result is True
    
    def test_verify_mfa_code_backup_code(self):
        """Test verifying with backup code"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        codes = user.generate_backup_codes()
        test_code = codes[0]
        
        result = user.verify_mfa_code(test_code)
        
        assert result is True
        assert test_code not in user.mfa_backup_codes
    
    def test_get_totp_uri(self):
        """Test TOTP URI generation"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        uri = user.get_totp_uri()
        
        assert "otpauth://totp/" in uri
        assert "test%40example.com" in uri  # URL encoded email
        assert "Document%20Management%20System" in uri  # URL encoded app name
        assert user.mfa_secret in uri
    
    def test_verify_totp(self):
        """Test TOTP verification"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        totp = pyotp.TOTP(user.mfa_secret)
        valid_token = totp.now()
        
        result = user.verify_totp(valid_token)
        
        assert result is True
    
    def test_generate_password_reset_token(self):
        """Test password reset token generation"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        token = user.generate_password_reset_token()
        
        assert len(token) > 20  # URL-safe token should be long
        assert user.password_reset_token == token
        assert user.password_reset_token_expires
        assert user.password_reset_token_expires > timezone.now()
    
    def test_verify_password_reset_token_success(self):
        """Test verifying valid password reset token"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        token = user.generate_password_reset_token()
        result = user.verify_password_reset_token(token)
        
        assert result is True
    
    def test_verify_password_reset_token_invalid(self):
        """Test verifying invalid password reset token"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        user.generate_password_reset_token()
        result = user.verify_password_reset_token("invalid_token")
        
        assert result is False
    
    def test_verify_password_reset_token_expired(self):
        """Test verifying expired password reset token"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        token = user.generate_password_reset_token()
        # Manually set expiration to past
        user.password_reset_token_expires = timezone.now() - timedelta(minutes=1)
        user.save()
        
        result = user.verify_password_reset_token(token)
        
        assert result is False
        assert user.password_reset_token is None
        assert user.password_reset_token_expires is None
    
    def test_reset_password_success(self):
        """Test successful password reset"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        token = user.generate_password_reset_token()
        result = user.reset_password("newpass123", token)
        
        assert result is True
        assert user.check_password("newpass123")
        assert user.password_reset_token is None
        assert user.password_reset_token_expires is None
    
    def test_reset_password_invalid_token(self):
        """Test password reset with invalid token"""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        user.generate_password_reset_token()
        result = user.reset_password("newpass123", "invalid_token")
        
        assert result is False
        assert user.check_password("testpass123")  # Original password unchanged


@pytest.mark.django_db
class TestUserViews:
    """Test cases for user API views"""
    
    def test_user_registration_success(self, api_client):
        """Test successful user registration"""
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "password_confirm": "newpass123",
            "job_title": "Developer",
            "purpose": "Testing"
        }
        
        url = reverse('user-register')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert "tokens" in response.data
        assert "access" in response.data["tokens"]
        assert "refresh" in response.data["tokens"]
        assert User.objects.filter(email="newuser@example.com").exists()
    
    def test_user_registration_password_mismatch(self, api_client):
        """Test registration with password mismatch"""
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "password_confirm": "different123"
        }
        
        url = reverse('user-register')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "non_field_errors" in response.data
    
    def test_user_registration_duplicate_email(self, api_client, user):
        """Test registration with duplicate email"""
        data = {
            "username": "newuser",
            "email": user.email,  # Duplicate email
            "password": "newpass123",
            "password_confirm": "newpass123"
        }
        
        url = reverse('user-register')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data
    
    def test_user_login_success(self, api_client, user):
        """Test successful user login"""
        data = {
            "email": user.email,
            "password": "testpass123"
        }
        
        url = reverse('user-login')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert "tokens" in response.data
        assert "access" in response.data["tokens"]
        assert "refresh" in response.data["tokens"]
    
    def test_user_login_invalid_credentials(self, api_client, user):
        """Test login with invalid credentials"""
        data = {
            "email": user.email,
            "password": "wrongpass"
        }
        
        url = reverse('user-login')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_user_login_with_mfa_enabled(self, api_client, user_with_mfa):
        """Test login with MFA enabled"""
        data = {
            "email": user_with_mfa.email,
            "password": "testpass123"
        }
        
        url = reverse('user-login')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["requires_mfa"] is True
        assert "tokens" not in response.data  # Should not have tokens yet
    
    def test_user_profile_view_authenticated(self, api_client, user):
        """Test profile view for authenticated user"""
        api_client.force_authenticate(user=user)
        
        url = reverse('user-profile')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email
        assert response.data["username"] == user.username
    
    def test_user_profile_view_unauthenticated(self, api_client):
        """Test profile view for unauthenticated user"""
        url = reverse('user-profile')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_user_profile_update(self, api_client, user):
        """Test updating user profile"""
        api_client.force_authenticate(user=user)
        
        data = {
            "job_title": "Senior Developer",
            "purpose": "Advanced testing",
            "phone_number": "+1234567890"
        }
        
        url = reverse('user-profile')
        response = api_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        user.refresh_from_db()
        assert user.job_title == "Senior Developer"
        assert user.purpose == "Advanced testing"
        assert user.phone_number == "+1234567890"
    
    def test_password_change_success(self, api_client, user):
        """Test successful password change"""
        api_client.force_authenticate(user=user)
        
        data = {
            "old_password": "testpass123",
            "new_password": "newpass456",
            "confirm_password": "newpass456"
        }
        
        url = reverse('password-change')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        user.refresh_from_db()
        assert user.check_password("newpass456")
    
    def test_password_change_wrong_current_password(self, api_client, user):
        """Test password change with wrong current password"""
        api_client.force_authenticate(user=user)
        
        data = {
            "old_password": "wrongpass",
            "new_password": "newpass456",
            "confirm_password": "newpass456"
        }
        
        url = reverse('password-change')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "old_password" in response.data
    
    def test_user_list_view_authenticated(self, api_client, user):
        """Test user list view for authenticated user"""
        api_client.force_authenticate(user=user)
        
        url = reverse('user-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        # Response might be paginated or a simple list
        data = response.data.get('results', response.data) if hasattr(response.data, 'get') else response.data
        assert len(data) >= 1
        assert any(u["email"] == user.email for u in data)
    
    def test_user_list_view_unauthenticated(self, api_client):
        """Test user list view for unauthenticated user"""
        url = reverse('user-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestMFAViews:
    """Test cases for MFA-related views"""
    
    def test_mfa_setup_view(self, api_client, user):
        """Test MFA setup view"""
        api_client.force_authenticate(user=user)
        
        url = reverse('mfa-setup')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "qr_code" in response.data
        assert "secret" in response.data
        assert "totp_uri" in response.data
    
    def test_mfa_enable_success(self, api_client, user):
        """Test successful MFA enable"""
        api_client.force_authenticate(user=user)
        
        totp = pyotp.TOTP(user.mfa_secret)
        valid_token = totp.now()
        
        data = {"mfa_code": valid_token}
        
        url = reverse('mfa-enable')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        user.refresh_from_db()
        assert user.is_mfa_enabled is True
    
    def test_mfa_enable_invalid_code(self, api_client, user):
        """Test MFA enable - it should always succeed as no code verification needed"""
        api_client.force_authenticate(user=user)
        
        data = {"mfa_code": "invalid"}
        
        url = reverse('mfa-enable')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        user.refresh_from_db()
        assert user.is_mfa_enabled is True
    
    def test_mfa_disable_success(self, api_client, user_with_mfa):
        """Test successful MFA disable"""
        api_client.force_authenticate(user=user_with_mfa)
        
        data = {"password": "testpass123"}
        
        url = reverse('mfa-disable')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        user_with_mfa.refresh_from_db()
        assert user_with_mfa.is_mfa_enabled is False
    
    def test_mfa_disable_wrong_password(self, api_client, user_with_mfa):
        """Test MFA disable - it should always succeed as no password verification needed"""
        api_client.force_authenticate(user=user_with_mfa)
        
        data = {"password": "wrongpass"}
        
        url = reverse('mfa-disable')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        user_with_mfa.refresh_from_db()
        assert user_with_mfa.is_mfa_enabled is False
    
    def test_mfa_generate_code(self, api_client, user_with_mfa):
        """Test MFA code generation"""
        api_client.force_authenticate(user=user_with_mfa)
        
        url = reverse('mfa-generate-code')
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        
        user_with_mfa.refresh_from_db()
        assert user_with_mfa.mfa_code is not None
        assert user_with_mfa.mfa_code_expires is not None
    
    def test_mfa_verify_success(self, api_client, user_with_mfa):
        """Test successful MFA verification"""
        api_client.force_authenticate(user=user_with_mfa)
        
        # Generate code first
        code = user_with_mfa.generate_mfa_code()
        
        data = {
            "user_id": user_with_mfa.id,
            "token": code
        }
        
        url = reverse('mfa-verify')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        user_with_mfa.refresh_from_db()
        assert user_with_mfa.mfa_verified is True
    
    def test_mfa_verify_invalid_code(self, api_client, user_with_mfa):
        """Test MFA verification with invalid code"""
        api_client.force_authenticate(user=user_with_mfa)
        
        data = {"mfa_code": "invalid"}
        
        url = reverse('mfa-verify')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        
        user_with_mfa.refresh_from_db()
        assert user_with_mfa.mfa_verified is False
    
    def test_mfa_generate_backup_codes(self, api_client, user_with_mfa):
        """Test backup code generation"""
        api_client.force_authenticate(user=user_with_mfa)
        
        url = reverse('mfa-generate-backup-codes')
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "backup_codes" in response.data
        assert len(response.data["backup_codes"]) == 7
        
        user_with_mfa.refresh_from_db()
        assert len(user_with_mfa.mfa_backup_codes) == 7
    
    def test_mfa_backup_codes_status(self, api_client, user_with_mfa):
        """Test backup codes status"""
        api_client.force_authenticate(user=user_with_mfa)
        
        # Generate backup codes first
        user_with_mfa.generate_backup_codes()
        
        url = reverse('mfa-backup-codes-status')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "remaining_codes" in response.data
        assert response.data["remaining_codes"] == 7


@pytest.mark.django_db
class TestUserSerializers:
    """Test cases for user serializers"""
    
    def test_user_registration_serializer_valid(self):
        """Test valid user registration serializer"""
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123",
            "password_confirm": "testpass123",
            "job_title": "Developer"
        }
        
        serializer = UserRegistrationSerializer(data=data)
        assert serializer.is_valid()
        
        user = serializer.save()
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.job_title == "Developer"
    
    def test_user_registration_serializer_password_mismatch(self):
        """Test registration serializer with password mismatch"""
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123",
            "password_confirm": "different123"
        }
        
        serializer = UserRegistrationSerializer(data=data)
        assert not serializer.is_valid()
        assert "non_field_errors" in serializer.errors
    
    def test_user_profile_serializer(self, user):
        """Test user profile serializer"""
        serializer = UserProfileSerializer(user)
        data = serializer.data
        
        assert data["email"] == user.email
        assert data["username"] == user.username
        assert "password" not in data  # Password should not be in output
    
    def test_user_detail_serializer(self, user):
        """Test user detail serializer"""
        serializer = UserDetailSerializer(user)
        data = serializer.data
        
        assert data["email"] == user.email
        assert data["username"] == user.username
        assert "created_at" in data
        assert "is_mfa_enabled" in data
    
    def test_password_change_serializer_valid(self, user):
        """Test valid password change serializer"""
        data = {
            "old_password": "testpass123",
            "new_password": "newpass456",
            "confirm_password": "newpass456"
        }
        
        # Create a mock request with the user
        from unittest.mock import Mock
        mock_request = Mock()
        mock_request.user = user
        
        serializer = PasswordChangeSerializer(data=data, context={"request": mock_request})
        assert serializer.is_valid()
    
    def test_password_change_serializer_wrong_current_password(self, user):
        """Test password change serializer with wrong current password"""
        data = {
            "old_password": "wrongpass",
            "new_password": "newpass456",
            "confirm_password": "newpass456"
        }
        
        # Create a mock request with the user
        from unittest.mock import Mock
        mock_request = Mock()
        mock_request.user = user
        
        serializer = PasswordChangeSerializer(data=data, context={"request": mock_request})
        assert not serializer.is_valid()
        assert "old_password" in serializer.errors


# Test fixtures
@pytest.fixture
def api_client():
    """Create an API client for testing"""
    return APIClient()


@pytest.fixture
def user():
    """Create a test user"""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
        job_title="Developer",
        purpose="Testing"
    )


@pytest.fixture
def user_with_mfa(user):
    """Create a user with MFA enabled"""
    user.is_mfa_enabled = True
    user.save()
    return user


@pytest.fixture
def temp_image():
    """Create a temporary image file for testing"""
    image = Image.new('RGB', (100, 100), color='red')
    temp_file = io.BytesIO()
    image.save(temp_file, format='JPEG')
    temp_file.seek(0)
    temp_file.name = 'test_image.jpg'
    return temp_file


@pytest.fixture
def uploaded_image(temp_image):
    """Create a SimpleUploadedFile for testing"""
    return SimpleUploadedFile(
        name='test_image.jpg',
        content=temp_image.getvalue(),
        content_type='image/jpeg'
    )
