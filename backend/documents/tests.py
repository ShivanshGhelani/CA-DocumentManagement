import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch, MagicMock
from django.utils import timezone
import tempfile
import os
from .models import Document, DocumentVersion, Tag, DocumentAuditLog, DocumentAccess
from .serializers import DocumentSerializer, DocumentVersionSerializer

User = get_user_model()


@pytest.mark.models
class TestDocumentModel:
    """Test Document model functionality."""

    @pytest.mark.django_db
    def test_create_document(self, user, temp_document):
        """Test creating a basic document."""
        document = Document.objects.create(
            title="Test Document",
            description="Test description",
            created_by=user,
            file=temp_document
        )
        assert document.title == "Test Document"
        assert document.created_by == user
        assert document.short_id is not None
        assert len(document.short_id) == 8
        assert not document.is_deleted

    @pytest.mark.django_db
    def test_document_string_representation(self, user, temp_document):
        """Test document string representation."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        assert str(document) == "Test Document"

    @pytest.mark.django_db
    def test_document_upload_path(self, user):
        """Test document upload path generation."""
        from .models import document_upload_path
        
        class MockInstance:
            def __init__(self):
                self.created_by = user
                self.short_id = "ABC12345"
        
        instance = MockInstance()
        filename = document_upload_path(instance, "test.pdf")
        expected_user_email = user.email.replace("@", "_at_").replace(".", "_")
        assert f"documents/{expected_user_email}/ABC12345/" in filename
        assert filename.endswith(".pdf")

    @pytest.mark.django_db
    def test_document_soft_delete(self, user, temp_document):
        """Test document soft delete functionality."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        document.soft_delete()
        assert document.is_deleted
        assert document.deleted_at is not None
        
        # Document should not appear in default queryset
        assert not Document.objects.filter(id=document.id).exists()
        
        # But should appear in all_with_deleted queryset
        assert Document.objects.all_with_deleted().filter(id=document.id).exists()

    @pytest.mark.django_db
    def test_document_restore(self, user, temp_document):
        """Test document restore functionality."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        document.soft_delete()
        document.restore()
        
        assert not document.is_deleted
        assert document.deleted_at is None
        assert Document.objects.filter(id=document.id).exists()

    @pytest.mark.django_db
    def test_document_file_size_calculation(self, user):
        """Test document file size calculation."""
        # Create a simple test file
        content = b"This is test content for file size calculation."
        temp_file = SimpleUploadedFile("test.txt", content, content_type="text/plain")
        
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_file
        )
        assert document.file_size == len(content)

    @pytest.mark.django_db
    def test_document_get_file_extension(self, user):
        """Test document file extension detection."""
        temp_file = SimpleUploadedFile("test.pdf", b"content", content_type="application/pdf")
        
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_file
        )
        assert document.get_file_extension() == "pdf"


@pytest.mark.models
class TestDocumentVersionModel:
    """Test DocumentVersion model functionality."""

    @pytest.mark.django_db
    def test_create_document_version(self, user, temp_document):
        """Test creating a document version."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        version_file = SimpleUploadedFile("version.txt", b"version content", content_type="text/plain")
        version = DocumentVersion.objects.create(
            document=document,
            version_number=2,
            created_by=user,
            file=version_file,
            notes="Version 2 notes"
        )
        
        assert version.document == document
        assert version.version_number == 2
        assert version.notes == "Version 2 notes"
        assert version.created_by == user

    @pytest.mark.django_db
    def test_document_version_upload_path(self, user, temp_document):
        """Test document version upload path generation."""
        from .models import document_version_upload_path
        
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        class MockInstance:
            def __init__(self):
                self.created_by = user
                self.document = document
                self.version_number = 2
        
        instance = MockInstance()
        filename = document_version_upload_path(instance, "version.pdf")
        expected_user_email = user.email.replace("@", "_at_").replace(".", "_")
        assert f"documents/{expected_user_email}/{document.short_id}/versions/2/" in filename

    @pytest.mark.django_db
    def test_get_latest_version(self, user, temp_document):
        """Test getting the latest version of a document."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        # Create multiple versions
        for i in range(2, 5):
            version_file = SimpleUploadedFile(f"version{i}.txt", b"content", content_type="text/plain")
            DocumentVersion.objects.create(
                document=document,
                version_number=i,
                created_by=user,
                file=version_file
            )
        
        latest_version = document.get_latest_version()
        assert latest_version.version_number == 4


@pytest.mark.models
class TestCategoryModel:
    """Test Category model functionality."""

    @pytest.mark.django_db
    def test_create_category(self):
        """Test creating a category."""
        category = Category.objects.create(
            name="Test Category",
            description="Test description"
        )
        assert category.name == "Test Category"
        assert category.slug == "test-category"
        assert str(category) == "Test Category"

    @pytest.mark.django_db
    def test_category_unique_slug(self):
        """Test category unique slug generation."""
        Category.objects.create(name="Test Category")
        category2 = Category.objects.create(name="Test Category")
        
        assert category2.slug != "test-category"
        assert "test-category" in category2.slug


@pytest.mark.models
class TestTagModel:
    """Test Tag model functionality."""

    @pytest.mark.django_db
    def test_create_tag(self):
        """Test creating a tag."""
        tag = Tag.objects.create(name="test-tag")
        assert tag.name == "test-tag"
        assert str(tag) == "test-tag"


@pytest.mark.models
class TestDocumentShareModel:
    """Test DocumentShare model functionality."""

    @pytest.mark.django_db
    def test_create_document_share(self, user, temp_document):
        """Test creating a document share."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        shared_user = User.objects.create_user(
            username="shareduser",
            email="shared@example.com",
            password="pass123"
        )
        
        share = DocumentShare.objects.create(
            document=document,
            shared_with=shared_user,
            shared_by=user,
            permission_level='view'
        )
        
        assert share.document == document
        assert share.shared_with == shared_user
        assert share.shared_by == user
        assert share.permission_level == 'view'

    @pytest.mark.django_db
    def test_document_share_string_representation(self, user, temp_document):
        """Test document share string representation."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        shared_user = User.objects.create_user(
            username="shareduser",
            email="shared@example.com",
            password="pass123"
        )
        
        share = DocumentShare.objects.create(
            document=document,
            shared_with=shared_user,
            shared_by=user,
            permission_level='view'
        )
        
        expected = f"{document.title} shared with {shared_user.username} (view)"
        assert str(share) == expected


@pytest.mark.api
class TestDocumentAPI:
    """Test Document API endpoints."""

    @pytest.mark.django_db
    def test_create_document_success(self, authenticated_client, user):
        """Test successful document creation."""
        url = reverse('documents:document-list')
        file_content = b"This is test document content."
        temp_file = SimpleUploadedFile("test.txt", file_content, content_type="text/plain")
        
        data = {
            'title': 'Test Document',
            'description': 'Test description',
            'file': temp_file
        }
        response = authenticated_client.post(url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED
        assert Document.objects.filter(title='Test Document').exists()

    @pytest.mark.django_db
    def test_list_documents(self, authenticated_client, user, temp_document):
        """Test listing documents."""
        # Create a test document
        Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        url = reverse('documents:document-list')
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 1

    @pytest.mark.django_db
    def test_get_document_detail(self, authenticated_client, user, temp_document):
        """Test getting document details."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        url = reverse('documents:document-detail', kwargs={'pk': document.pk})
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == "Test Document"

    @pytest.mark.django_db
    def test_update_document(self, authenticated_client, user, temp_document):
        """Test updating a document."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        url = reverse('documents:document-detail', kwargs={'pk': document.pk})
        data = {'title': 'Updated Document Title'}
        response = authenticated_client.patch(url, data)
        assert response.status_code == status.HTTP_200_OK
        
        document.refresh_from_db()
        assert document.title == 'Updated Document Title'

    @pytest.mark.django_db
    def test_delete_document(self, authenticated_client, user, temp_document):
        """Test deleting a document (soft delete)."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        url = reverse('documents:document-detail', kwargs={'pk': document.pk})
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        document.refresh_from_db()
        assert document.is_deleted

    @pytest.mark.django_db
    def test_unauthorized_access(self, api_client, user, temp_document):
        """Test unauthorized access to documents."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        url = reverse('documents:document-detail', kwargs={'pk': document.pk})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.api
class TestDocumentVersionAPI:
    """Test DocumentVersion API endpoints."""

    @pytest.mark.django_db
    def test_create_document_version(self, authenticated_client, user, temp_document):
        """Test creating a new document version."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        url = reverse('documents:document-version-list', kwargs={'document_pk': document.pk})
        version_file = SimpleUploadedFile("version.txt", b"version content", content_type="text/plain")
        
        data = {
            'version_number': 2,
            'file': version_file,
            'notes': 'Version 2 notes'
        }
        response = authenticated_client.post(url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED
        assert DocumentVersion.objects.filter(document=document, version_number=2).exists()

    @pytest.mark.django_db
    def test_list_document_versions(self, authenticated_client, user, temp_document):
        """Test listing document versions."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        # Create a version
        version_file = SimpleUploadedFile("version.txt", b"content", content_type="text/plain")
        DocumentVersion.objects.create(
            document=document,
            version_number=2,
            created_by=user,
            file=version_file
        )
        
        url = reverse('documents:document-version-list', kwargs={'document_pk': document.pk})
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 1


@pytest.mark.api
class TestDocumentShareAPI:
    """Test DocumentShare API endpoints."""

    @pytest.mark.django_db
    def test_share_document(self, authenticated_client, user, temp_document):
        """Test sharing a document with another user."""
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=temp_document
        )
        
        shared_user = User.objects.create_user(
            username="shareduser",
            email="shared@example.com",
            password="pass123"
        )
        
        url = reverse('documents:document-share-list', kwargs={'document_pk': document.pk})
        data = {
            'shared_with': shared_user.id,
            'permission_level': 'view'
        }
        response = authenticated_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert DocumentShare.objects.filter(
            document=document,
            shared_with=shared_user
        ).exists()


@pytest.mark.integration
class TestDocumentSearchAndFilter:
    """Test document search and filtering functionality."""

    @pytest.mark.django_db
    def test_search_documents_by_title(self, authenticated_client, user):
        """Test searching documents by title."""
        # Create test documents
        file1 = SimpleUploadedFile("doc1.txt", b"content1", content_type="text/plain")
        file2 = SimpleUploadedFile("doc2.txt", b"content2", content_type="text/plain")
        
        Document.objects.create(title="Important Report", created_by=user, file=file1)
        Document.objects.create(title="Meeting Notes", created_by=user, file=file2)
        
        url = reverse('documents:document-list')
        response = authenticated_client.get(url, {'search': 'Important'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['title'] == "Important Report"

    @pytest.mark.django_db
    def test_filter_documents_by_category(self, authenticated_client, user):
        """Test filtering documents by category."""
        category = Category.objects.create(name="Reports")
        
        file1 = SimpleUploadedFile("doc1.txt", b"content1", content_type="text/plain")
        document = Document.objects.create(
            title="Test Document",
            created_by=user,
            file=file1,
            category=category
        )
        
        url = reverse('documents:document-list')
        response = authenticated_client.get(url, {'category': category.id})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
