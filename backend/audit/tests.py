import pytest
from django.urls import reverse
from django.contrib.contenttypes.models import ContentType
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import Mock, patch
import uuid
from datetime import datetime, timezone

from .models import AuditLog
from accounts.models import User
from documents.models import Document


@pytest.mark.django_db
class TestAuditLogModel:
    """Test cases for AuditLog model"""
    
    def test_create_audit_log(self, user):
        """Test creating an audit log entry"""
        audit_log = AuditLog.objects.create(
            user=user,
            action='create',
            resource_type='document',
            resource_id='123',
            resource_name='Test Document',
            details={'key': 'value'},
            ip_address='192.168.1.1'
        )
        
        assert audit_log.id is not None
        assert audit_log.user == user
        assert audit_log.action == 'create'
        assert audit_log.resource_type == 'document'
        assert audit_log.resource_id == '123'
        assert audit_log.resource_name == 'Test Document'
        assert audit_log.details == {'key': 'value'}
        assert audit_log.ip_address == '192.168.1.1'
        assert audit_log.timestamp is not None
    
    def test_audit_log_str_representation(self, user):
        """Test string representation of audit log"""
        audit_log = AuditLog.objects.create(
            user=user,
            action='update',
            resource_type='user',
            resource_id=str(user.id)
        )
        
        expected = f"{user.email} - update user at {audit_log.timestamp}"
        assert str(audit_log) == expected
    
    def test_audit_log_str_representation_anonymous(self):
        """Test string representation with anonymous user"""
        audit_log = AuditLog.objects.create(
            user=None,
            action='read',
            resource_type='document',
            resource_id='456'
        )
        
        expected = f"Anonymous - read document at {audit_log.timestamp}"
        assert str(audit_log) == expected
    
    def test_audit_log_ordering(self, user):
        """Test audit logs are ordered by timestamp descending"""
        # Create multiple audit logs
        log1 = AuditLog.objects.create(
            user=user,
            action='create',
            resource_type='document',
            resource_id='1'
        )
        log2 = AuditLog.objects.create(
            user=user,
            action='update',
            resource_type='document',
            resource_id='2'
        )
        
        logs = list(AuditLog.objects.all())
        assert logs[0] == log2  # Most recent first
        assert logs[1] == log1
    
    def test_generic_foreign_key(self, user, document):
        """Test generic foreign key functionality"""
        audit_log = AuditLog.objects.create(
            user=user,
            action='read',
            resource_type='document',
            resource_id=str(document.id),
            content_object=document
        )
        
        assert audit_log.content_object == document
        assert audit_log.content_type == ContentType.objects.get_for_model(Document)
        # object_id might be stored as UUID or string depending on Django version
        assert str(audit_log.object_id) == str(document.id)
    
    def test_log_activity_class_method(self, user, document):
        """Test the log_activity class method"""
        # Mock request object
        mock_request = Mock()
        mock_request.META = {
            'HTTP_X_FORWARDED_FOR': '192.168.1.100, 10.0.0.1',
            'HTTP_USER_AGENT': 'Test User Agent'
        }
        
        audit_log = AuditLog.log_activity(
            user=user,
            action='download',
            resource_type='document',
            resource_id=document.id,
            resource_name=document.title,
            details={'format': 'pdf'},
            request=mock_request,
            content_object=document
        )
        
        assert audit_log.user == user
        assert audit_log.action == 'download'
        assert audit_log.resource_type == 'document'
        assert audit_log.resource_id == str(document.id)
        assert audit_log.resource_name == document.title
        assert audit_log.details == {'format': 'pdf'}
        assert audit_log.ip_address == '192.168.1.100'
        assert audit_log.user_agent == 'Test User Agent'
        assert audit_log.content_object == document
    
    def test_log_activity_without_request(self, user):
        """Test log_activity method without request"""
        audit_log = AuditLog.log_activity(
            user=user,
            action='create',
            resource_type='tag',
            resource_id='123',
            resource_name='Important'
        )
        
        assert audit_log.user == user
        assert audit_log.action == 'create'
        assert audit_log.ip_address is None
        assert audit_log.user_agent == ''
    
    def test_get_client_ip_with_forwarded_header(self):
        """Test IP extraction with X-Forwarded-For header"""
        mock_request = Mock()
        mock_request.META = {
            'HTTP_X_FORWARDED_FOR': '192.168.1.100, 10.0.0.1',
            'REMOTE_ADDR': '127.0.0.1'
        }
        
        ip = AuditLog.get_client_ip(mock_request)
        assert ip == '192.168.1.100'
    
    def test_get_client_ip_without_forwarded_header(self):
        """Test IP extraction without X-Forwarded-For header"""
        mock_request = Mock()
        mock_request.META = {
            'REMOTE_ADDR': '127.0.0.1'
        }
        
        ip = AuditLog.get_client_ip(mock_request)
        assert ip == '127.0.0.1'
    
    def test_audit_log_action_choices(self):
        """Test that all action choices are valid"""
        valid_actions = [choice[0] for choice in AuditLog.ACTION_CHOICES]
        expected_actions = [
            'create', 'read', 'update', 'delete', 'login',
            'logout', 'download', 'share', 'upload'
        ]
        
        for action in expected_actions:
            assert action in valid_actions


@pytest.mark.django_db
class TestAuditLogViews:
    """Test cases for audit log API views"""
    
    def test_audit_log_list_authenticated_user(self, api_client, user, audit_logs):
        """Test audit log list view for authenticated user"""
        api_client.force_authenticate(user=user)
        url = reverse('audit-log-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        # User should only see their own logs (2 out of 3 total)
        assert len(response.data['results']) == 2
        
        # Check that all returned logs belong to the user
        for log_data in response.data['results']:
            assert log_data['user_email'] == user.email
    
    def test_audit_log_list_staff_user(self, api_client, staff_user, audit_logs):
        """Test audit log list view for staff user"""
        api_client.force_authenticate(user=staff_user)
        url = reverse('audit-log-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        # Staff should see all logs
        assert len(response.data['results']) == 3
    
    def test_audit_log_list_unauthenticated(self, api_client):
        """Test audit log list view without authentication"""
        url = reverse('audit-log-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_audit_log_list_filtering(self, api_client, user, audit_logs):
        """Test filtering audit logs"""
        api_client.force_authenticate(user=user)
        url = reverse('audit-log-list')
        
        # Filter by action
        response = api_client.get(url, {'action': 'create'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['action'] == 'create'
        
        # Filter by resource_type
        response = api_client.get(url, {'resource_type': 'document'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 2
    
    def test_audit_log_list_search(self, api_client, user, audit_logs):
        """Test searching audit logs"""
        api_client.force_authenticate(user=user)
        url = reverse('audit-log-list')
        
        # Search by resource name - should find 2 logs with "Test Document 1"
        response = api_client.get(url, {'search': 'Test Document 1'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 2
        assert 'Test Document' in response.data['results'][0]['resource_name']
    
    def test_audit_log_list_ordering(self, api_client, user, audit_logs):
        """Test ordering audit logs"""
        api_client.force_authenticate(user=user)
        url = reverse('audit-log-list')
        
        response = api_client.get(url, {'ordering': 'timestamp'})
        assert response.status_code == status.HTTP_200_OK
        
        # Check that results are ordered by timestamp ascending
        timestamps = [log['timestamp'] for log in response.data['results']]
        assert timestamps == sorted(timestamps)
    
    def test_audit_log_detail_authenticated_user(self, api_client, user, audit_logs):
        """Test audit log detail view for authenticated user"""
        api_client.force_authenticate(user=user)
        
        # Get user's own audit log
        user_log = AuditLog.objects.filter(user=user).first()
        url = reverse('audit-log-detail', kwargs={'pk': user_log.id})
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(user_log.id)
        assert response.data['user']['email'] == user.email
    
    def test_audit_log_detail_staff_user(self, api_client, staff_user, audit_logs):
        """Test audit log detail view for staff user"""
        api_client.force_authenticate(user=staff_user)
        
        # Get any audit log
        any_log = AuditLog.objects.first()
        url = reverse('audit-log-detail', kwargs={'pk': any_log.id})
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(any_log.id)
    
    def test_audit_log_detail_forbidden_access(self, api_client, user, other_user):
        """Test that user cannot access other user's audit logs"""
        api_client.force_authenticate(user=user)
        
        # Create audit log for other user
        other_log = AuditLog.objects.create(
            user=other_user,
            action='create',
            resource_type='document',
            resource_id='999'
        )
        
        url = reverse('audit-log-detail', kwargs={'pk': other_log.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_audit_log_detail_unauthenticated(self, api_client, audit_logs):
        """Test audit log detail view without authentication"""
        any_log = AuditLog.objects.first()
        url = reverse('audit-log-detail', kwargs={'pk': any_log.id})
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_audit_log_detail_nonexistent(self, api_client, user):
        """Test audit log detail view with nonexistent ID"""
        api_client.force_authenticate(user=user)
        
        nonexistent_id = uuid.uuid4()
        url = reverse('audit-log-detail', kwargs={'pk': nonexistent_id})
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAuditLogSerializers:
    """Test cases for audit log serializers"""
    
    def test_audit_log_serializer(self, user):
        """Test AuditLogSerializer"""
        from .serializers import AuditLogSerializer
        
        audit_log = AuditLog.objects.create(
            user=user,
            action='create',
            resource_type='document',
            resource_id='123',
            resource_name='Test Document',
            details={'format': 'pdf'},
            ip_address='192.168.1.1',
            user_agent='Test Agent'
        )
        
        serializer = AuditLogSerializer(audit_log)
        data = serializer.data
        
        assert data['id'] == str(audit_log.id)
        assert data['user']['email'] == user.email
        assert data['action'] == 'create'
        assert data['resource_type'] == 'document'
        assert data['resource_id'] == '123'
        assert data['resource_name'] == 'Test Document'
        assert data['details'] == {'format': 'pdf'}
        assert data['ip_address'] == '192.168.1.1'
        assert data['user_agent'] == 'Test Agent'
        assert 'timestamp_formatted' in data
    
    def test_audit_log_list_serializer(self, user):
        """Test AuditLogListSerializer"""
        from .serializers import AuditLogListSerializer
        
        audit_log = AuditLog.objects.create(
            user=user,
            action='update',
            resource_type='user',
            resource_id=str(user.id),
            resource_name=user.email,
            ip_address='10.0.0.1'
        )
        
        serializer = AuditLogListSerializer(audit_log)
        data = serializer.data
        
        assert data['id'] == str(audit_log.id)
        assert data['user_email'] == user.email
        assert data['action'] == 'update'
        assert data['resource_type'] == 'user'
        assert data['resource_name'] == user.email
        assert data['ip_address'] == '10.0.0.1'
        assert 'timestamp_formatted' in data
        
        # Should not include sensitive fields like user_agent, details
        assert 'user_agent' not in data
        assert 'details' not in data
    
    def test_timestamp_formatted_field(self, user):
        """Test timestamp_formatted field in serializers"""
        from .serializers import AuditLogSerializer
        
        audit_log = AuditLog.objects.create(
            user=user,
            action='read',
            resource_type='document',
            resource_id='456'
        )
        
        serializer = AuditLogSerializer(audit_log)
        formatted_timestamp = serializer.data['timestamp_formatted']
        
        # Check format is correct
        assert len(formatted_timestamp) == 19 + 4  # 'YYYY-MM-DD HH:MM:SS UTC'
        assert formatted_timestamp.endswith(' UTC')
        
        # Verify it matches the expected format
        expected_format = audit_log.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
        assert formatted_timestamp == expected_format


# Fixtures for audit tests
@pytest.fixture
def user():
    """Create a test user."""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123"
    )


@pytest.fixture
def staff_user():
    """Create a staff user."""
    return User.objects.create_user(
        username="staffuser",
        email="staff@example.com",
        password="staffpass123",
        is_staff=True
    )


@pytest.fixture
def other_user():
    """Create another test user."""
    return User.objects.create_user(
        username="otheruser",
        email="other@example.com",
        password="otherpass123"
    )


@pytest.fixture
def document(user):
    """Create a test document."""
    from documents.models import Document
    return Document.objects.create(
        title="Test Document",
        description="A test document",
        created_by=user
    )


@pytest.fixture
def audit_logs(user, other_user):
    """Create sample audit logs for testing"""
    logs = []
    
    # User's logs
    logs.append(AuditLog.objects.create(
        user=user,
        action='create',
        resource_type='document',
        resource_id='1',
        resource_name='Test Document 1',
        ip_address='192.168.1.1'
    ))
    
    logs.append(AuditLog.objects.create(
        user=user,
        action='update',
        resource_type='document',
        resource_id='1',
        resource_name='Test Document 1',
        ip_address='192.168.1.1'
    ))
    
    # Other user's log
    logs.append(AuditLog.objects.create(
        user=other_user,
        action='delete',
        resource_type='document',
        resource_id='2',
        resource_name='Other Document',
        ip_address='192.168.1.2'
    ))
    
    return logs
