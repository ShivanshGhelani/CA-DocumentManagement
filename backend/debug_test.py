import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()

def test_debug_create_version():
    """Debug test to see the actual error"""
    api_client = APIClient()
    
    # Create test user
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com", 
        password="testpass123"
    )
    
    # Create test document
    from documents.models import Document
    document = Document.objects.create(
        title="Test Document",
        description="Test Description",
        created_by=user
    )
    
    # Create test file
    temp_document = SimpleUploadedFile(
        name='test_document.txt',
        content=b'Test content',
        content_type='text/plain'
    )
    
    api_client.force_authenticate(user=user)
    
    data = {
        "file": temp_document,
        "changes_description": "New version",
    }
    
    url = reverse('create-document-version', kwargs={'pk': document.id})
    response = api_client.post(url, data, format='multipart')
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.data}")
    
    return response
