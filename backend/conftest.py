import pytest
import os
import django
from django.conf import settings
from django.test.utils import override_settings
from django.core.management import call_command

# Configure Django settings first
if not settings.configured:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
import tempfile
from PIL import Image
import io

User = get_user_model()


@pytest.fixture(scope="session")
def django_db_setup():
    """Set up the test database."""
    settings.DATABASES["default"] = {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
        "ATOMIC_REQUESTS": True,
    }


@pytest.fixture
def api_client():
    """Create an API client for testing."""
    return APIClient()


@pytest.fixture
def user():
    """Create a test user."""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User"
    )


@pytest.fixture
def admin_user():
    """Create an admin user."""
    return User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="adminpass123",
        first_name="Admin",
        last_name="User"
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Create an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    """Create an authenticated admin API client."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def temp_image():
    """Create a temporary image file for testing."""
    image = Image.new('RGB', (100, 100), color='red')
    temp_file = io.BytesIO()
    image.save(temp_file, format='JPEG')
    temp_file.seek(0)
    temp_file.name = 'test_image.jpg'
    return temp_file


@pytest.fixture
def temp_document():
    """Create a temporary document file for testing."""
    temp_file = io.BytesIO(b"This is a test document content.")
    temp_file.name = 'test_document.txt'
    temp_file.seek(0)
    return temp_file


@pytest.fixture
def media_root(settings, tmp_path):
    """Override MEDIA_ROOT to use temporary directory."""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """Enable database access for all tests."""
    pass


@pytest.fixture
def user_with_mfa(user):
    """Create a user with MFA enabled."""
    user.is_mfa_enabled = True
    user.mfa_secret = "JBSWY3DPEHPK3PXP"  # Base32 encoded secret
    user.save()
    return user


@pytest.fixture
def mock_s3_storage():
    """Mock S3 storage for testing."""
    with override_settings(
        DEFAULT_FILE_STORAGE='django.core.files.storage.FileSystemStorage',
        STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage',
    ):
        yield


# Custom markers for different test categories
pytestmark = [
    pytest.mark.django_db,
]
