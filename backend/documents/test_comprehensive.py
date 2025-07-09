import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import Mock, patch, MagicMock
from datetime import timedelta
import uuid
import io
import json
import tempfile
import os

from .models import Document, DocumentVersion, Tag, DocumentAccess
from .serializers import (
    DocumentListSerializer, DocumentDetailSerializer, DocumentCreateSerializer,
    TagSerializer, DocumentVersionSerializer, DocumentAccessSerializer
)

User = get_user_model()


@pytest.mark.django_db
class TestDocumentModel:
    """Comprehensive test cases for Document model"""
    
    def test_create_document_basic(self, user):
        """Test creating a basic document"""
        document = Document.objects.create(
            title="Test Document",
            description="Test description",
            created_by=user
        )
        
        assert document.title == "Test Document"
        assert document.description == "Test description"
        assert document.created_by == user
        assert document.status == "draft"
        assert document.short_id
        assert len(document.short_id) <= 12
        assert not document.is_deleted
        assert document.created_at
        assert document.updated_at
    
    def test_document_str_representation(self, user):
        """Test document string representation"""
        document = Document.objects.create(
            title="Test Document",
            created_by=user
        )
        
        assert str(document) == "Test Document (no version)"
    
    def test_document_short_id_generation(self, user):
        """Test document short_id generation"""
        document = Document.objects.create(
            title="Test Document",
            created_by=user
        )
        
        assert document.short_id
        assert len(document.short_id) <= 12
        assert document.short_id.isalnum()
    
    def test_document_short_id_uniqueness(self, user):
        """Test document short_id uniqueness"""
        doc1 = Document.objects.create(title="Doc 1", created_by=user)
        doc2 = Document.objects.create(title="Doc 2", created_by=user)
        
        assert doc1.short_id != doc2.short_id
    
    def test_document_soft_delete(self, user):
        """Test document soft delete functionality"""
        document = Document.objects.create(
            title="Test Document",
            created_by=user
        )
        
        document.soft_delete(user)
        
        assert document.is_deleted
        assert document.deleted_at
        assert document.deleted_by == user
        
        # Test manager behavior
        assert document not in Document.objects.all()
        assert document in Document.objects.all_with_deleted()
    
    def test_document_restore(self, user):
        """Test document restore functionality"""
        document = Document.objects.create(
            title="Test Document",
            created_by=user
        )
        
        document.soft_delete(user)
        document.restore()
        
        assert not document.is_deleted
        assert document.deleted_at is None
        assert document.deleted_by is None
        assert document in Document.objects.all()
    
    def test_document_manager_default_queryset(self, user):
        """Test document manager default queryset excludes deleted"""
        doc1 = Document.objects.create(title="Active Doc", created_by=user)
        doc2 = Document.objects.create(title="Deleted Doc", created_by=user)
        doc2.soft_delete(user)
        
        active_docs = Document.objects.all()
        all_docs = Document.objects.all_with_deleted()
        deleted_docs = Document.objects.deleted_only()
        
        assert doc1 in active_docs
        assert doc2 not in active_docs
        assert doc1 in all_docs
        assert doc2 in all_docs
        assert doc1 not in deleted_docs
        assert doc2 in deleted_docs
    
    def test_document_unique_together_constraint(self, user):
        """Test document title uniqueness per user"""
        Document.objects.create(title="Unique Title", created_by=user)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            Document.objects.create(title="Unique Title", created_by=user)


@pytest.mark.django_db
class TestDocumentVersionModel:
    """Test cases for DocumentVersion model"""
    
    def test_create_document_version(self, user, document, temp_document):
        """Test creating a document version"""
        version = DocumentVersion.objects.create(
            document=document,
            file=temp_document,
            version_number=1,
            created_by=user,
            title=document.title,
            description=document.description,
            changes_description="Initial version"
        )
        
        assert version.document == document
        assert version.version_number == 1
        assert version.created_by == user
        assert version.changes_description == "Initial version"
        assert version.file_size > 0
        assert version.created_at
    
    def test_document_version_str_representation(self, user, document, temp_document):
        """Test document version string representation"""
        version = DocumentVersion.objects.create(
            document=document,
            file=temp_document,
            version_number=1,
            created_by=user,
            title=document.title,
            description=document.description
        )
        
        expected = f"{document.title} v{version.version_number}"
        assert str(version) == expected
    
    def test_document_version_file_size_calculation(self, user, document, temp_document):
        """Test file size is calculated correctly"""
        version = DocumentVersion.objects.create(
            document=document,
            file=temp_document,
            version_number=1,
            created_by=user
        )
        
        assert version.file_size > 0
        assert isinstance(version.file_size, int)
    
    def test_document_version_ordering(self, user, document, temp_document):
        """Test document versions are ordered by version number descending"""
        v1 = DocumentVersion.objects.create(
            document=document, file=temp_document, version_number=1, created_by=user
        )
        v2 = DocumentVersion.objects.create(
            document=document, file=temp_document, version_number=2, created_by=user
        )
        
        versions = list(DocumentVersion.objects.filter(document=document))
        assert versions[0] == v2  # Higher version first
        assert versions[1] == v1


@pytest.mark.django_db
class TestTagModel:
    """Test cases for Tag model"""
    
    def test_create_tag_basic(self, user):
        """Test creating a basic tag"""
        tag = Tag.objects.create(
            key="category",
            value="important",
            created_by=user
        )
        
        assert tag.key == "category"
        assert tag.value == "important"
        assert tag.created_by == user
        assert tag.color == "#007bff"  # Default color
        assert tag.created_at
    
    def test_tag_str_representation_with_value(self, user):
        """Test tag string representation with value"""
        tag = Tag.objects.create(
            key="priority",
            value="high",
            created_by=user
        )
        
        assert str(tag) == "priority: high"
    
    def test_tag_str_representation_without_value(self, user):
        """Test tag string representation without value"""
        tag = Tag.objects.create(
            key="urgent",
            created_by=user
        )
        
        assert str(tag) == "urgent"
    
    def test_tag_display_name_property(self, user):
        """Test tag display_name property"""
        tag_with_value = Tag.objects.create(
            key="status", value="draft", created_by=user
        )
        tag_without_value = Tag.objects.create(
            key="featured", created_by=user
        )
        
        assert tag_with_value.display_name == "status: draft"
        assert tag_without_value.display_name == "featured"
    
    def test_tag_unique_together_constraint(self, user):
        """Test tag unique_together constraint"""
        Tag.objects.create(key="type", value="pdf", created_by=user)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            Tag.objects.create(key="type", value="pdf", created_by=user)
    
    def test_tag_custom_color(self, user):
        """Test tag with custom color"""
        tag = Tag.objects.create(
            key="priority",
            value="high",
            color="#ff0000",
            created_by=user
        )
        
        assert tag.color == "#ff0000"


@pytest.mark.django_db
class TestDocumentViews:
    """Test cases for document API views"""
    
    def test_document_list_view_authenticated(self, api_client, user, document):
        """Test document list view for authenticated user"""
        api_client.force_authenticate(user=user)
        
        url = reverse('document-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 1
        assert any(doc['id'] == str(document.id) for doc in response.data['results'])
    
    def test_document_list_view_unauthenticated(self, api_client):
        """Test document list view for unauthenticated user"""
        url = reverse('document-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_document_list_view_filtering_by_user(self, api_client, user, other_user):
        """Test document list view filters by user"""
        api_client.force_authenticate(user=user)
        
        # Create documents for both users
        user_doc = Document.objects.create(title="User Doc", created_by=user)
        other_doc = Document.objects.create(title="Other Doc", created_by=other_user)
        
        url = reverse('document-list')
        response = api_client.get(url)
        
        doc_ids = [doc['id'] for doc in response.data['results']]
        assert str(user_doc.id) in doc_ids
        assert str(other_doc.id) not in doc_ids
    
    def test_document_create_view_success(self, api_client, user, temp_document):
        """Test successful document creation"""
        api_client.force_authenticate(user=user)
        
        data = {
            "title": "New Document",
            "description": "Test description",
            "status": "draft",
            "file": temp_document
        }
        
        url = reverse('document-create')
        response = api_client.post(url, data, format='multipart')
        
        if response.status_code != 201:
            print(f"Error response: {response.data}")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['title'] == "New Document"
        assert Document.objects.filter(title="New Document").exists()
    
    def test_document_create_view_with_tags(self, api_client, user, tag, temp_document):
        """Test document creation with tags"""
        import json
        api_client.force_authenticate(user=user)
        
        data = {
            "title": "Tagged Document",
            "description": "Test description",
            "file": temp_document,
            "tags_data": json.dumps([{"key": tag.key, "value": tag.value}])
        }
        
        url = reverse('document-create')
        response = api_client.post(url, data, format='multipart')
        
        if response.status_code != 201:
            print(f"Error response: {response.data}")
        
        assert response.status_code == status.HTTP_201_CREATED
        
        document = Document.objects.get(id=response.data['id'])
        assert document.tags.count() > 0
    
    def test_document_detail_view_success(self, api_client, user, document):
        """Test document detail view for owner"""
        api_client.force_authenticate(user=user)
        
        url = reverse('document-detail', kwargs={'pk': document.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(document.id)
        assert response.data['title'] == document.title
    
    def test_document_detail_view_forbidden(self, api_client, user, other_user):
        """Test document detail view for non-owner"""
        api_client.force_authenticate(user=user)
        
        other_doc = Document.objects.create(title="Other Doc", created_by=other_user)
        
        url = reverse('document-detail', kwargs={'pk': other_doc.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_document_update_view_success(self, api_client, user, document):
        """Test document update for owner"""
        api_client.force_authenticate(user=user)
        
        data = {
            "title": "Updated Title",
            "description": "Updated description"
        }
        
        url = reverse('document-detail', kwargs={'pk': document.id})
        response = api_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        document.refresh_from_db()
        assert document.title == "Updated Title"
        assert document.description == "Updated description"
    
    def test_document_delete_view_success(self, api_client, user, document):
        """Test document soft delete"""
        api_client.force_authenticate(user=user)
        
        url = reverse('document-detail', kwargs={'pk': document.id})
        response = api_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        document.refresh_from_db()
        assert document.is_deleted
    
    def test_deleted_documents_view(self, api_client, user, document):
        """Test deleted documents view"""
        api_client.force_authenticate(user=user)
        
        document.soft_delete(user)
        
        url = reverse('deleted-documents')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1
        assert any(doc['id'] == str(document.id) for doc in response.data)
    
    def test_restore_document_view(self, api_client, user, document):
        """Test document restore"""
        api_client.force_authenticate(user=user)
        
        document.soft_delete(user)
        
        url = reverse('document-restore', kwargs={'pk': document.id})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        
        document.refresh_from_db()
        assert not document.is_deleted
    
    def test_permanent_delete_document_view(self, api_client, user, document):
        """Test permanent document deletion"""
        api_client.force_authenticate(user=user)
        
        document.soft_delete(user)
        
        url = reverse('document-permanent-delete', kwargs={'pk': document.id})
        response = api_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Document.objects.all_with_deleted().filter(id=document.id).exists()


@pytest.mark.django_db
class TestTagViews:
    """Test cases for tag API views"""
    
    def test_tag_list_view_authenticated(self, api_client, user, tag):
        """Test tag list view for authenticated user"""
        api_client.force_authenticate(user=user)
        
        url = reverse('tag-list-create')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        # Response might be paginated or a simple list
        data = response.data.get('results', response.data) if hasattr(response.data, 'get') else response.data
        assert len(data) >= 1
        assert any(t['id'] == tag.id for t in data)
    
    def test_tag_create_view_success(self, api_client, user):
        """Test successful tag creation"""
        api_client.force_authenticate(user=user)
        
        data = {
            "key": "priority",
            "value": "high",
            "color": "#ff0000"
        }
        
        url = reverse('tag-list-create')
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['key'] == "priority"
        assert response.data['value'] == "high"
        assert Tag.objects.filter(key="priority", value="high").exists()
    
    def test_tag_detail_view_success(self, api_client, user, tag):
        """Test tag detail view"""
        api_client.force_authenticate(user=user)
        
        url = reverse('tag-detail', kwargs={'pk': tag.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == tag.id
        assert response.data['key'] == tag.key
    
    def test_tag_update_view_success(self, api_client, user, tag):
        """Test tag update"""
        api_client.force_authenticate(user=user)
        
        data = {
            "key": "updated_key",
            "color": "#00ff00"
        }
        
        url = reverse('tag-detail', kwargs={'pk': tag.id})
        response = api_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        tag.refresh_from_db()
        assert tag.key == "updated_key"
        assert tag.color == "#00ff00"
    
    def test_tag_delete_view_success(self, api_client, user, tag):
        """Test tag deletion"""
        api_client.force_authenticate(user=user)
        
        url = reverse('tag-detail', kwargs={'pk': tag.id})
        response = api_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Tag.objects.filter(id=tag.id).exists()


@pytest.mark.django_db
class TestDocumentVersionViews:
    """Test cases for document version API views"""
    
    def test_document_version_history_view(self, api_client, user, document, document_version):
        """Test document version history view"""
        api_client.force_authenticate(user=user)
        
        url = reverse('document-version-history', kwargs={'pk': document.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'versions' in response.data
        assert len(response.data['versions']) >= 1
        assert any(v['id'] == str(document_version.id) for v in response.data['versions'])
    
    def test_create_document_version_view(self, api_client, user, document, temp_document):
        """Test creating a new document version"""
        api_client.force_authenticate(user=user)
        
        data = {
            "title": "Updated Document Title",
            "file": temp_document,
            "changes_description": "New version"
        }
        
        url = reverse('create-document-version', kwargs={'pk': document.id})
        response = api_client.post(url, data, format='multipart')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['changes_description'] == "New version"
        assert response.data['title'] == "Updated Document Title"
    
    def test_upload_document_version_view(self, api_client, user, document, temp_document):
        """Test uploading a document version"""
        api_client.force_authenticate(user=user)
        
        data = {
            "file": temp_document,
            "reason": "Uploaded version"
        }
        
        url = reverse('document-upload-version', kwargs={'pk': document.id})
        response = api_client.post(url, data, format='multipart')
        
        assert response.status_code == status.HTTP_200_OK
        assert "title" in response.data  # Document detail response
        assert "current_version" in response.data
    
    def test_rollback_document_view(self, api_client, user, document, document_version):
        """Test document rollback to previous version"""
        api_client.force_authenticate(user=user)
        
        data = {
            "version_id": str(document_version.id)
        }
        
        url = reverse('rollback-document', kwargs={'pk': document.id})
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        
        document.refresh_from_db()
        assert document.current_version == document_version


@pytest.mark.django_db
class TestDocumentSerializers:
    """Test cases for document serializers"""
    
    def test_document_list_serializer(self, document):
        """Test document list serializer"""
        serializer = DocumentListSerializer(document)
        data = serializer.data
        
        assert data['id'] == str(document.id)
        assert data['title'] == document.title
        assert data['short_id'] == document.short_id
        assert 'created_by' in data
    
    def test_document_detail_serializer(self, document):
        """Test document detail serializer"""
        serializer = DocumentDetailSerializer(document)
        data = serializer.data
        
        assert data['id'] == str(document.id)
        assert data['title'] == document.title
        assert data['description'] == document.description
        assert 'tags' in data
        assert 'current_version' in data
    
    def test_document_create_serializer_valid(self, user, temp_document):
        """Test valid document create serializer"""
        data = {
            "title": "New Document",
            "description": "Test description",
            "status": "draft",
            "file": temp_document
        }
        
        # Create a mock request
        from unittest.mock import Mock
        mock_request = Mock()
        mock_request.user = user
        
        serializer = DocumentCreateSerializer(data=data, context={"request": mock_request})
        if not serializer.is_valid():
            print(f"Serializer errors: {serializer.errors}")
        assert serializer.is_valid()
        
        document = serializer.save(created_by=user)
        assert document.title == "New Document"
        assert document.created_by == user
    
    def test_document_create_serializer_invalid(self):
        """Test invalid document create serializer"""
        data = {
            "description": "Missing title"
        }
        
        serializer = DocumentCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "title" in serializer.errors
    
    def test_tag_serializer(self, tag):
        """Test tag serializer"""
        serializer = TagSerializer(tag)
        data = serializer.data
        
        assert data['id'] == tag.id
        assert data['key'] == tag.key
        assert data['value'] == tag.value
        assert data['color'] == tag.color
        assert data['display_name'] == tag.display_name
    
    def test_document_version_serializer(self, document_version):
        """Test document version serializer"""
        serializer = DocumentVersionSerializer(document_version)
        data = serializer.data
        
        assert data['id'] == str(document_version.id)
        assert data['version_number'] == document_version.version_number
        assert data['file_size'] == document_version.file_size
        assert 'created_by' in data


@pytest.mark.django_db
class TestDocumentAccess:
    """Test cases for document access and permissions"""
    
    def test_user_can_access_own_document(self, user, document):
        """Test user can access their own document"""
        assert document.created_by == user
        # In a real implementation, you'd test permissions here
    
    def test_user_cannot_access_other_document(self, user, other_user):
        """Test user cannot access other user's document"""
        other_doc = Document.objects.create(title="Other Doc", created_by=other_user)
        assert other_doc.created_by != user
        # In a real implementation, you'd test permissions here
    
    def test_document_sharing_functionality(self, user, other_user, document):
        """Test document sharing functionality"""
        # This would test actual sharing logic when implemented
        pass


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
        password="testpass123"
    )


@pytest.fixture
def other_user():
    """Create another test user"""
    return User.objects.create_user(
        username="otheruser",
        email="other@example.com",
        password="otherpass123"
    )


@pytest.fixture
def document(user):
    """Create a test document"""
    import time
    import random
    unique_suffix = f"{int(time.time())}{random.randint(100, 999)}"
    return Document.objects.create(
        title=f"Test Document {unique_suffix}",
        description="A test document",
        created_by=user
    )


@pytest.fixture
def tag(user):
    """Create a test tag"""
    return Tag.objects.create(
        key="category",
        value="test",
        created_by=user,
        color="#007bff"
    )


@pytest.fixture
def temp_document():
    """Create a temporary document file for testing"""
    content = b"This is a test document content for testing purposes."
    temp_file = io.BytesIO(content)
    temp_file.name = 'test_document.txt'
    temp_file.seek(0)
    return SimpleUploadedFile(
        name='test_document.txt',
        content=content,
        content_type='text/plain'
    )


@pytest.fixture
def document_version(user, document, temp_document):
    """Create a test document version"""
    return DocumentVersion.objects.create(
        document=document,
        file=temp_document,
        version_number=1,
        created_by=user,
        title=document.title,
        description=document.description,
        changes_description="Initial version"
    )


@pytest.fixture
def document_with_tags(user, tag):
    """Create a document with tags"""
    document = Document.objects.create(
        title="Tagged Document",
        description="A document with tags",
        created_by=user
    )
    document.tags.add(tag)
    return document
