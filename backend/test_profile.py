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
import json

def test_profile_functionality():
    """Test the profile functionality end-to-end"""
    print("Testing profile functionality...")
    
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
    
    # Test getting profile
    response = client.get('/api/auth/profile/')
    print(f"Get profile response: {response.status_code}")
    
    if response.status_code == 200:
        profile_data = json.loads(response.content.decode())
        print(f"Profile data: {profile_data}")
        
        # Test updating profile
        update_data = {
            'username': 'updateduser',
            'first_name': 'Updated',
            'last_name': 'User',
            'job_title': 'Software Developer',
            'purpose': 'Testing the document management system',
            'phone_number': '+1234567890'
        }
        
        update_response = client.patch('/api/auth/profile/', 
                                     json.dumps(update_data), 
                                     content_type='application/json')
        print(f"Update profile response: {update_response.status_code}")
        
        if update_response.status_code == 200:
            updated_data = json.loads(update_response.content.decode())
            print(f"✓ Profile updated successfully: {updated_data['job_title']}")
        else:
            print(f"✗ Profile update failed: {update_response.content.decode()}")
        
        # Test password change
        password_data = {
            'old_password': 'testpass123',
            'new_password': 'newtestpass123',
            'confirm_password': 'newtestpass123'
        }
        
        password_response = client.post('/api/auth/password/change/', 
                                      json.dumps(password_data), 
                                      content_type='application/json')
        print(f"Password change response: {password_response.status_code}")
        
        if password_response.status_code == 200:
            print("✓ Password changed successfully")
            # Change it back for future tests
            user.set_password('testpass123')
            user.save()
        else:
            print(f"✗ Password change failed: {password_response.content.decode()}")
    else:
        print(f"Error getting profile: {response.content.decode()}")

if __name__ == "__main__":
    test_profile_functionality()
