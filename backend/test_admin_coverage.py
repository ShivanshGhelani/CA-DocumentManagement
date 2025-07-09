import pytest
from django.test import TestCase, RequestFactory
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from unittest.mock import patch, Mock
from documents.admin import DocumentAdmin, DocumentVersionAdmin, TagAdmin
from documents.models import Document, DocumentVersion, Tag
from audit.admin import AuditLogAdmin
from audit.models import AuditLog

User = get_user_model()


@pytest.mark.django_db
class TestDocumentAdmin:
    """Test cases for DocumentAdmin functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.site = AdminSite()
        self.admin = DocumentAdmin(Document, self.site)
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123'
        )
        self.document = Document.objects.create(
            title='Test Document',
            description='Test Description',
            created_by=self.user
        )
    
    def test_status_badge_display(self):
        """Test status_badge admin method"""
        badge_html = self.admin.status_badge(self.document)
        assert 'DRAFT' in badge_html
        assert 'background-color:' in badge_html  # Should have styling
    
    def test_file_info_display(self):
        """Test file_info admin method"""
        file_info_html = self.admin.file_info(self.document)
        assert 'No file' in file_info_html or 'Type:' in file_info_html
    
    def test_versions_count_display(self):
        """Test versions_count admin method"""
        # Create a version
        DocumentVersion.objects.create(
            document=self.document,
            version_number=1,
            title='Version 1',
            created_by=self.user
        )
        count_html = self.admin.versions_count(self.document)
        assert '1 versions' in count_html
        assert 'href=' in count_html  # Should be a link
    
    def test_storage_usage_display(self):
        """Test storage_usage admin method"""
        storage_html = self.admin.storage_usage(self.document)
        assert 'B' in storage_html or 'KB' in storage_html or 'MB' in storage_html or 'GB' in storage_html
    
    def test_tags_display(self):
        """Test tags_display admin method"""
        # Create a tag and assign it
        tag = Tag.objects.create(
            key='test',
            value='tag',
            created_by=self.user
        )
        self.document.tags.add(tag)
        tags_html = self.admin.tags_display(self.document)
        assert 'test: tag' in tags_html
        assert 'background-color:' in tags_html

    def test_format_file_size(self):
        """Test format_file_size method"""
        # Test different file sizes
        assert self.admin.format_file_size(512) == "512 B"
        assert "KB" in self.admin.format_file_size(1024)
        assert "MB" in self.admin.format_file_size(1024 * 1024)
        assert "GB" in self.admin.format_file_size(1024 * 1024 * 1024)
    
    def test_current_version_display(self):
        """Test current_version_display admin method"""
        # Create version and set as current
        version = DocumentVersion.objects.create(
            document=self.document,
            version_number=1,
            title='Version 1',
            created_by=self.user
        )
        self.document.current_version = version
        self.document.save()
        
        version_display = self.admin.current_version_display(self.document)
        assert 'v1' in version_display
    
    def test_file_size_display(self):
        """Test file_size_display admin method"""
        size_display = self.admin.file_size_display(self.document)
        assert 'No file' in size_display or 'B' in size_display
    
    def test_status_badge_display(self):
        """Test status_badge admin method"""
        badge_html = self.admin.status_badge(self.document)
        assert 'DRAFT' in badge_html
        assert 'background-color:' in badge_html  # Should have styling
    
    def test_restore_documents_action(self):
        """Test restore_documents bulk action"""
        request = self.factory.post('/admin/documents/document/')
        request.user = self.user
        
        # Delete document first
        self.document.is_deleted = True
        self.document.save()
        
        queryset = Document.objects.filter(id=self.document.id)
        self.admin.restore_documents(request, queryset)
        
        self.document.refresh_from_db()
        assert self.document.is_deleted is False
    
    def test_publish_documents_action(self):
        """Test publish_documents bulk action"""
        request = self.factory.post('/admin/documents/document/')
        request.user = self.user
        
        queryset = Document.objects.filter(id=self.document.id)
        self.admin.publish_documents(request, queryset)
        
        self.document.refresh_from_db()
        assert self.document.status == 'published'


@pytest.mark.django_db
class TestDocumentVersionAdmin:
    """Test cases for DocumentVersionAdmin functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.site = AdminSite()
        self.admin = DocumentVersionAdmin(DocumentVersion, self.site)
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123'
        )
        self.document = Document.objects.create(
            title='Test Document',
            description='Test Description',
            created_by=self.user
        )
        self.version = DocumentVersion.objects.create(
            document=self.document,
            version_number=1,
            title='Version 1',
            created_by=self.user
        )
    
    def test_document_title_display(self):
        """Test document_title admin method"""
        title_html = self.admin.document_title(self.version)
        assert 'Test Document' in title_html
    
    def test_version_display(self):
        """Test version_display admin method"""
        version_html = self.admin.version_display(self.version)
        assert 'v1' in version_html
    
    def test_file_size_display(self):
        """Test file_size_display admin method"""
        size_display = self.admin.file_size_display(self.version)
        assert 'No file' in size_display or 'B' in size_display


@pytest.mark.django_db
class TestTagAdmin:
    """Test cases for TagAdmin functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.site = AdminSite()
        self.admin = TagAdmin(Tag, self.site)
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123'
        )
        self.tag = Tag.objects.create(
            key='category',
            value='test',
            created_by=self.user
        )
    
    def test_display_name_method(self):
        """Test display_name admin method"""
        display = self.admin.display_name(self.tag)
        assert 'category: test' in display
    
    def test_usage_count_method(self):
        """Test usage_count admin method"""
        count = self.admin.usage_count(self.tag)
        assert count == 0  # No documents using this tag yet


@pytest.mark.django_db
class TestAuditLogAdmin:
    """Test cases for AuditLogAdmin functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.site = AdminSite()
        self.admin = AuditLogAdmin(AuditLog, self.site)
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123'
        )
        self.audit_log = AuditLog.objects.create(
            user=self.user,
            action='create',
            resource_type='document',
            resource_id='123',
            resource_name='Test Document',
            ip_address='192.168.1.1'
        )
    
    def test_user_email_display(self):
        """Test user_email admin method"""
        email = self.admin.user_email(self.audit_log)
        assert email == 'test@example.com'
    
    def test_action_badge_display(self):
        """Test action_badge admin method"""
        badge = self.admin.action_badge(self.audit_log)
        assert 'badge' in badge
        assert 'create' in badge
    
    def test_resource_link_display(self):
        """Test resource_link admin method"""
        link = self.admin.resource_link(self.audit_log)
        assert 'Test Document' in link
    
    def test_timestamp_formatted_display(self):
        """Test timestamp_formatted admin method"""
        formatted = self.admin.timestamp_formatted(self.audit_log)
        assert 'UTC' in formatted
