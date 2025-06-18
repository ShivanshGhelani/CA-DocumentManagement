#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to the path
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from accounts.models import User
from documents.models import Document
import json

def test_soft_delete():
    """Test the soft delete functionality end-to-end"""
    print("Testing soft delete functionality...")
    
    # Create Django test client
    client = Client()
    
    # Get the test user and login
    try:
        user = User.objects.get(email='test@example.com')
        client.force_login(user)
        print(f"Logged in as user: {user.email}")
    except User.DoesNotExist:
        print("Test user not found")
        return
    
    # Test the documents list endpoint
    response = client.get('/api/documents/')
    print(f"Documents list response: {response.status_code}")
    
    if response.status_code == 200:
        data = json.loads(response.content.decode())
        print(f"Number of documents: {len(data.get('results', []))}")
        
        if data.get('results'):
            doc = data['results'][0]
            print(f"First document: {doc['title']} (ID: {doc['id']})")
            
            # Test the delete endpoint
            delete_response = client.delete(f"/api/documents/{doc['id']}/")
            print(f"Delete response: {delete_response.status_code}")
            
            if delete_response.status_code in [200, 204]:
                print("✓ Delete successful")
                
                # Check if document is gone from list
                after_response = client.get('/api/documents/')
                if after_response.status_code == 200:
                    after_data = json.loads(after_response.content.decode())
                    print(f"Documents after delete: {len(after_data.get('results', []))}")
                    
                    if len(after_data.get('results', [])) == 0:
                        print("✓ Document successfully hidden from list (soft deleted)")
                    else:
                        print("✗ Document still appears in list")
                else:
                    print(f"Error getting documents after delete: {after_response.status_code}")
            else:
                print(f"✗ Delete failed: {delete_response.content.decode()}")
        else:
            print("No documents found to test delete")
    else:
        print(f"Error accessing documents: {response.content.decode()}")

if __name__ == "__main__":
    test_soft_delete()
