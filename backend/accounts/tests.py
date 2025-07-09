import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch, MagicMock
from django.core import mail
from django.utils import timezone
from datetime import timedelta
import pyotp
from .models import User
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, MFASetupSerializer,
    MFAVerifySerializer, UserProfileSerializer
)

User = get_user_model()


@pytest.mark.models
class TestUserModel:
    """Test User model functionality."""
    
    @pytest.mark.django_db
    def test_create_user(self):
        """Test creating a basic user."""
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

    @pytest.mark.django_db
    def test_create_superuser(self):
        """Test creating a superuser."""
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123"
        )
        assert user.is_staff
        assert user.is_superuser

    @pytest.mark.django_db
    def test_user_string_representation(self):
        """Test user string representation."""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        assert str(user) == "testuser"

    @pytest.mark.django_db
    def test_generate_mfa_secret(self, user):
        """Test MFA secret generation."""
        secret = user.generate_mfa_secret()
        assert len(secret) == 32
        assert user.mfa_secret == secret

    @pytest.mark.django_db
    def test_get_mfa_qr_code_url(self, user):
        """Test MFA QR code URL generation."""
        user.generate_mfa_secret()
        qr_url = user.get_mfa_qr_code_url()
        assert "otpauth://totp/" in qr_url
        assert user.email in qr_url

    @pytest.mark.django_db
    def test_verify_mfa_token_valid(self, user):
        """Test MFA token verification with valid token."""
        user.generate_mfa_secret()
        totp = pyotp.TOTP(user.mfa_secret)
        token = totp.now()
        assert user.verify_mfa_token(token) is True

    @pytest.mark.django_db
    def test_verify_mfa_token_invalid(self, user):
        """Test MFA token verification with invalid token."""
        user.generate_mfa_secret()
        assert user.verify_mfa_token("000000") is False

    @pytest.mark.django_db
    def test_generate_backup_codes(self, user):
        """Test backup codes generation."""
        codes = user.generate_backup_codes()
        assert len(codes) == 10
        assert all(len(code) == 8 for code in codes)
        assert user.mfa_backup_codes == codes

    @pytest.mark.django_db
    def test_verify_backup_code_valid(self, user):
        """Test backup code verification with valid code."""
        codes = user.generate_backup_codes()
        code = codes[0]
        assert user.verify_backup_code(code) is True
        # Code should be removed after use
        assert code not in user.mfa_backup_codes

    @pytest.mark.django_db
    def test_verify_backup_code_invalid(self, user):
        """Test backup code verification with invalid code."""
        user.generate_backup_codes()
        assert user.verify_backup_code("invalid") is False

    @pytest.mark.django_db
    def test_generate_password_reset_token(self, user):
        """Test password reset token generation."""
        token = user.generate_password_reset_token()
        assert len(token) == 64
        assert user.password_reset_token == token
        assert user.password_reset_token_expires > timezone.now()

    @pytest.mark.django_db
    def test_user_avatar_path(self, user):
        """Test user avatar upload path generation."""
        from .models import user_avatar_path
        filename = user_avatar_path(user, "avatar.jpg")
        assert f"avatars/{user.username}/" in filename
        assert filename.endswith(".jpg")


@pytest.mark.api
class TestUserRegistrationAPI:
    """Test user registration API endpoints."""

    @pytest.mark.django_db
    def test_user_registration_success(self, api_client):
        """Test successful user registration."""
        url = reverse('accounts:register')
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'strongpassword123',
            'password_confirm': 'strongpassword123',
            'first_name': 'New',
            'last_name': 'User',
            'job_title': 'Developer',
            'purpose': 'Testing the application'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(username='newuser').exists()

    @pytest.mark.django_db
    def test_user_registration_password_mismatch(self, api_client):
        """Test user registration with password mismatch."""
        url = reverse('accounts:register')
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'strongpassword123',
            'password_confirm': 'differentpassword',
            'first_name': 'New',
            'last_name': 'User'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_user_registration_duplicate_email(self, api_client, user):
        """Test user registration with duplicate email."""
        url = reverse('accounts:register')
        data = {
            'username': 'newuser',
            'email': user.email,  # Duplicate email
            'password': 'strongpassword123',
            'password_confirm': 'strongpassword123',
            'first_name': 'New',
            'last_name': 'User'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.api
@pytest.mark.auth
class TestUserLoginAPI:
    """Test user login API endpoints."""

    @pytest.mark.django_db
    def test_user_login_success(self, api_client, user):
        """Test successful user login."""
        url = reverse('accounts:login')
        data = {
            'email': user.email,
            'password': 'testpass123'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data

    @pytest.mark.django_db
    def test_user_login_invalid_credentials(self, api_client, user):
        """Test login with invalid credentials."""
        url = reverse('accounts:login')
        data = {
            'email': user.email,
            'password': 'wrongpassword'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_user_login_with_mfa_required(self, api_client, user_with_mfa):
        """Test login when MFA is required."""
        url = reverse('accounts:login')
        data = {
            'email': user_with_mfa.email,
            'password': 'testpass123'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['mfa_required'] is True


@pytest.mark.api
@pytest.mark.auth
class TestMFAAPI:
    """Test MFA API endpoints."""

    @pytest.mark.django_db
    def test_mfa_setup(self, authenticated_client, user):
        """Test MFA setup."""
        url = reverse('accounts:mfa-setup')
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert 'secret' in response.data
        assert 'qr_code' in response.data

    @pytest.mark.django_db
    def test_mfa_verify_success(self, authenticated_client, user):
        """Test successful MFA verification."""
        user.generate_mfa_secret()
        totp = pyotp.TOTP(user.mfa_secret)
        token = totp.now()
        
        url = reverse('accounts:mfa-verify')
        data = {'token': token}
        response = authenticated_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_mfa_verify_invalid_token(self, authenticated_client, user):
        """Test MFA verification with invalid token."""
        user.generate_mfa_secret()
        
        url = reverse('accounts:mfa-verify')
        data = {'token': '000000'}
        response = authenticated_client.post(url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_mfa_backup_codes_request(self, authenticated_client, user_with_mfa):
        """Test MFA backup codes request."""
        url = reverse('accounts:mfa-backup-codes')
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert 'backup_codes' in response.data


@pytest.mark.api
class TestUserProfileAPI:
    """Test user profile API endpoints."""

    @pytest.mark.django_db
    def test_get_user_profile(self, authenticated_client, user):
        """Test getting user profile."""
        url = reverse('accounts:profile')
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == user.username
        assert response.data['email'] == user.email

    @pytest.mark.django_db
    def test_update_user_profile(self, authenticated_client, user):
        """Test updating user profile."""
        url = reverse('accounts:profile')
        data = {
            'first_name': 'Updated',
            'last_name': 'Name',
            'job_title': 'Senior Developer'
        }
        response = authenticated_client.patch(url, data)
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == 'Updated'
        assert user.last_name == 'Name'
        assert user.job_title == 'Senior Developer'


@pytest.mark.api
class TestPasswordResetAPI:
    """Test password reset API endpoints."""

    @pytest.mark.django_db
    @patch('accounts.utils.send_password_reset_email')
    def test_password_reset_request(self, mock_send_email, api_client, user):
        """Test password reset request."""
        url = reverse('accounts:password-reset-request')
        data = {'email': user.email}
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK
        mock_send_email.assert_called_once()

    @pytest.mark.django_db
    def test_password_reset_confirm(self, api_client, user):
        """Test password reset confirmation."""
        token = user.generate_password_reset_token()
        url = reverse('accounts:password-reset-confirm')
        data = {
            'token': token,
            'password': 'newpassword123',
            'password_confirm': 'newpassword123'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password('newpassword123')


@pytest.mark.utils
class TestAccountsUtils:
    """Test accounts utility functions."""

    @pytest.mark.django_db
    @patch('django.core.mail.send_mail')
    def test_send_password_reset_email(self, mock_send_mail, user):
        """Test password reset email sending."""
        from .utils import send_password_reset_email
        token = user.generate_password_reset_token()
        send_password_reset_email(user, token)
        mock_send_mail.assert_called_once()

    @pytest.mark.django_db
    @patch('django.core.mail.send_mail')
    def test_send_mfa_backup_codes_email(self, mock_send_mail, user):
        """Test MFA backup codes email sending."""
        from .utils import send_mfa_backup_codes_email
        codes = user.generate_backup_codes()
        send_mfa_backup_codes_email(user, codes)
        mock_send_mail.assert_called_once()
