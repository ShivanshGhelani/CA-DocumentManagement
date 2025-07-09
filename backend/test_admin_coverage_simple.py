import pytest
from django.test import TestCase, RequestFactory
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.messages.middleware import MessageMiddleware
from django.contrib.sessions.middleware import SessionMiddleware
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
        assert 'background-color:' in badge_html
    
    def test_file_info_display(self):
        """Test file_info admin method"""
        file_info_html = self.admin.file_info(self.document)
        assert 'No file' in file_info_html or 'Type:' in file_info_html

    def test_versions_count_display(self):
        """Test versions_count admin method"""
        count_html = self.admin.versions_count(self.document)
        assert 'versions' in count_html
    
    def test_storage_usage_display(self):
        """Test storage_usage admin method"""
        storage_html = self.admin.storage_usage(self.document)
        assert 'B' in storage_html
    
    def test_format_file_size(self):
        """Test format_file_size method"""
        # Test boundary values correctly
        assert self.admin.format_file_size(512) == "512 B"
        assert "KB" in self.admin.format_file_size(2048)  # > 1024
        assert "MB" in self.admin.format_file_size(2 * 1024 * 1024)
        assert "GB" in self.admin.format_file_size(2 * 1024 * 1024 * 1024)


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
            created_by=self.user
        )
        self.version = DocumentVersion.objects.create(
            document=self.document,
            version_number=1,
            title='Version 1',
            created_by=self.user,
            file_size=1024
        )
    
    def test_document_title_display(self):
        """Test document_title admin method"""
        title_html = self.admin.document_title(self.version)
        assert 'Test Document' in title_html
        assert 'href=' in title_html
    
    def test_file_info_display(self):
        """Test file_info admin method"""
        file_info_html = self.admin.file_info(self.version)
        assert 'Type:' in file_info_html
        assert 'Size:' in file_info_html


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
            key='test',
            value='tag',
            created_by=self.user
        )
    
    def test_display_name_colored(self):
        """Test display_name_colored admin method"""
        colored_html = self.admin.display_name_colored(self.tag)
        assert 'test: tag' in colored_html
        assert 'background-color:' in colored_html
    
    def test_usage_count(self):
        """Test usage_count admin method"""
        count = self.admin.usage_count(self.tag)
        assert count == 0
