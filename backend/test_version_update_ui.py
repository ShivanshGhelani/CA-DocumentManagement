"""
Test to verify that version uploads and rollbacks properly update UI state
"""
import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from documents.models import Document, DocumentVersion, Tag
import tempfile
import os

User = get_user_model()


@pytest.mark.django_db
class TestVersionUpdateUI:
    """Test cases to verify version upload and rollback UI updates"""
    
    def setup_method(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create a test document
        self.document = Document.objects.create(
            title='Test Document',
            description='Test Description',
            created_by=self.user
        )
        
        # Create initial version
        test_content = b"This is test content for version 1"
        test_file = SimpleUploadedFile(
            name='test_document_v1.txt',
            content=test_content,
            content_type='text/plain'
        )
        
        self.version1 = DocumentVersion.objects.create(
            document=self.document,
            file=test_file,
            version_number=1,
            title='Test Document',
            description='Test Description',
            created_by=self.user,
            file_size=len(test_content)
        )
        
        # Set as current version
        self.document.current_version = self.version1
        self.document.version = 1
        self.document.save()
    
    def test_document_detail_shows_current_version(self):
        """Test that document detail API returns current version info"""
        response = self.client.get(f'/api/documents/{self.document.id}/')
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that the document shows version 1 details
        assert data['version'] == 1
        assert data['title'] == 'Test Document'
        assert data['description'] == 'Test Description'
    
    def test_upload_new_version_updates_document_details(self):
        """Test that uploading a new version updates document details"""
        # Create new version with updated details
        new_content = b"This is updated content for version 2"
        new_file = SimpleUploadedFile(
            name='test_document_v2.txt',
            content=new_content,
            content_type='text/plain'
        )
        
        # Create a tag for the new version
        tag = Tag.objects.create(
            key='priority',
            value='high',
            created_by=self.user
        )
        
        # Upload new version with different title and tag
        response = self.client.post(f'/api/documents/{self.document.id}/versions/create/', {
            'file': new_file,
            'inherit_metadata': False,
            'title': 'Updated Test Document',
            'description': 'Updated Description',
            'tag_ids': [tag.id],
            'changes_description': 'Added high priority tag and updated content',
            'reason': 'Testing version update'
        })
        
        assert response.status_code == 201        # Refresh document from database
        self.document.refresh_from_db()

        # Check that document now shows version 2 details
        assert self.document.version_number == 2
        assert self.document.current_version.version_number == 2

        # Get document details via API
        detail_response = self.client.get(f'/api/documents/{self.document.id}/')
        detail_data = detail_response.json()

        # Verify the document detail API returns updated info
        assert detail_data['version'] == 2
        assert detail_data['title'] == 'Updated Test Document'
        assert detail_data['description'] == 'Updated Description'
        assert len(detail_data['tags']) == 1
        assert detail_data['tags'][0]['key'] == 'priority'
        assert detail_data['tags'][0]['value'] == 'high'
    
    def test_rollback_updates_document_details(self):
        """Test that rollback updates document details correctly"""
        # First, create version 2
        new_content = b"This is content for version 2"
        new_file = SimpleUploadedFile(
            name='test_document_v2.txt',
            content=new_content,
            content_type='text/plain'
        )
        
        tag = Tag.objects.create(
            key='status',
            value='draft',
            created_by=self.user
        )
        
        version2_response = self.client.post(f'/api/documents/{self.document.id}/versions/create/', {
            'file': new_file,
            'inherit_metadata': False,
            'title': 'Version 2 Title',
            'description': 'Version 2 Description',
            'tag_ids': [tag.id],
            'changes_description': 'Created version 2',
        })
        
        assert version2_response.status_code == 201
        
        # Verify we're now on version 2
        self.document.refresh_from_db()
        assert self.document.version_number == 2
        
        # Now rollback to version 1
        rollback_response = self.client.post(f'/api/documents/{self.document.id}/rollback/', {
            'version_id': self.version1.id
        })
        
        assert rollback_response.status_code == 200
        
        # Refresh document
        self.document.refresh_from_db()
        
        # Verify we're back to version 1 details
        assert self.document.version_number == 1
        assert self.document.current_version.id == self.version1.id
        
        # Get document details via API
        detail_response = self.client.get(f'/api/documents/{self.document.id}/')
        detail_data = detail_response.json()
        
        # Verify the document detail API returns version 1 info
        assert detail_data['version'] == 1
        assert detail_data['title'] == 'Test Document'  # Original title
        assert detail_data['description'] == 'Test Description'  # Original description
        # Tags should be empty since version 1 had no tags
        assert len(detail_data.get('tags', [])) == 0
    
    def test_version_history_shows_correct_current_version(self):
        """Test that version history correctly identifies current version"""
        # Create version 2
        new_content = b"Content for version 2"
        new_file = SimpleUploadedFile(
            name='test_v2.txt',
            content=new_content,
            content_type='text/plain'
        )
        
        self.client.post(f'/api/documents/{self.document.id}/versions/create/', {
            'file': new_file,
            'inherit_metadata': True,
            'changes_description': 'Version 2',
        })
        
        # Get version history
        history_response = self.client.get(f'/api/documents/{self.document.id}/versions/')
        history_data = history_response.json()
        
        # Should have 2 versions
        assert len(history_data['versions']) == 2
        
        # Version 2 should be marked as current
        version_2 = next(v for v in history_data['versions'] if v['version_number'] == 2)
        version_1 = next(v for v in history_data['versions'] if v['version_number'] == 1)
        
        assert version_2['is_current'] is True
        assert version_1['is_current'] is False
        
        # Current version in response header should be 2
        assert history_data['current_version'] == 2

    def test_document_list_shows_current_version_details(self):
        """Test that document list API shows current version details"""
        # Get initial list
        list_response = self.client.get('/api/documents/')
        list_data = list_response.json()
        
        doc_in_list = next(d for d in list_data['results'] if d['id'] == str(self.document.id))
        assert doc_in_list['version'] == 1
        
        # Upload new version
        new_content = b"Updated content"
        new_file = SimpleUploadedFile(
            name='updated.txt',
            content=new_content,
            content_type='text/plain'
        )
        
        self.client.post(f'/api/documents/{self.document.id}/versions/create/', {
            'file': new_file,
            'inherit_metadata': False,
            'title': 'Updated in List',
            'description': 'Updated description',
            'changes_description': 'Testing list update',
        })
        
        # Get updated list
        updated_list_response = self.client.get('/api/documents/')
        updated_list_data = updated_list_response.json()
        
        updated_doc_in_list = next(d for d in updated_list_data['results'] if d['id'] == str(self.document.id))
        
        # Should show version 2 details
        assert updated_doc_in_list['version'] == 2
        assert updated_doc_in_list['title'] == 'Updated in List'
        assert updated_doc_in_list['description'] == 'Updated description'
    
    def test_delete_version_functionality(self):
        """Test that version deletion works correctly for owners"""
        # Create version 2
        new_content = b"This is content for version 2"
        new_file = SimpleUploadedFile(
            name='test_document_v2.txt',
            content=new_content,
            content_type='text/plain'
        )
        
        response = self.client.post(f'/api/documents/{self.document.id}/versions/create/', {
            'file': new_file,
            'inherit_metadata': True,
            'changes_description': 'Added version 2',
            'reason': 'Testing version deletion'
        })
        assert response.status_code == 201
        
        # Get the new version ID
        self.document.refresh_from_db()
        version_2 = self.document.versions.filter(version_number=2).first()
        assert version_2 is not None
        
        # Should not be able to delete current version
        response = self.client.delete(f'/api/documents/{self.document.id}/versions/{version_2.id}/delete/')
        assert response.status_code == 400
        assert 'current version' in response.json()['detail']
        
        # Rollback to version 1
        version_1 = self.document.versions.filter(version_number=1).first()
        rollback_response = self.client.post(f'/api/documents/{self.document.id}/rollback/', {
            'version_id': str(version_1.id)
        })
        assert rollback_response.status_code == 200
        
        # Now should be able to delete version 2
        response = self.client.delete(f'/api/documents/{self.document.id}/versions/{version_2.id}/delete/')
        assert response.status_code == 204
        
        # Verify version 2 is gone
        self.document.refresh_from_db()
        remaining_versions = self.document.versions.all()
        assert len(remaining_versions) == 1
        assert remaining_versions[0].version_number == 1
