import pytest
from django.test import TestCase, RequestFactory
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.messages import get_messages
from django.urls import reverse
from unittest.mock import patch, Mock
from accounts.admin import UserAdmin, InviteUserForm
from accounts.models import User

User = get_user_model()


@pytest.mark.django_db
class TestUserAdmin:
    """Test cases for UserAdmin functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.site = AdminSite()
        self.admin = UserAdmin(User, self.site)
        self.factory = RequestFactory()
        self.superuser = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123'
        )
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123'
        )
    
    def test_full_name_display(self):
        """Test full_name admin method"""
        # User with first and last name
        user_with_name = User.objects.create_user(
            username='john',
            email='john@example.com',
            password='pass123',
            first_name='John',
            last_name='Doe'
        )
        assert self.admin.full_name(user_with_name) == 'John Doe'
        
        # User without names falls back to username
        assert self.admin.full_name(self.user) == 'testuser'
    
    def test_documents_count_display(self):
        """Test documents_count admin method"""
        from documents.models import Document
        
        # Create documents for user
        Document.objects.create(
            title='Doc 1',
            description='Test doc',
            created_by=self.user
        )
        Document.objects.create(
            title='Doc 2',
            description='Test doc',
            created_by=self.user
        )
        
        count = self.admin.documents_count(self.user)
        assert count == 2
    
    def test_storage_usage_display(self):
        """Test storage_usage admin method"""
        usage = self.admin.storage_usage(self.user)
        assert 'B' in usage  # Should show bytes format
    
    def test_recent_activity_display(self):
        """Test recent_activity admin method"""
        activity = self.admin.recent_activity(self.user)
        assert 'actions (7 days)' in activity
    
    def test_user_actions_display(self):
        """Test user_actions admin method"""
        # Active user should show deactivate button
        actions = self.admin.user_actions(self.user)
        assert 'Deactivate' in actions
        
        # Inactive user should show activate button
        self.user.is_active = False
        self.user.save()
        actions = self.admin.user_actions(self.user)
        assert 'Activate' in actions
    
    def test_activate_users_action(self):
        """Test activate_users bulk action"""
        request = self.factory.post('/admin/accounts/user/')
        request.user = self.superuser
        
        # Deactivate user first
        self.user.is_active = False
        self.user.save()
        
        queryset = User.objects.filter(id=self.user.id)
        self.admin.activate_users(request, queryset)
        
        self.user.refresh_from_db()
        assert self.user.is_active is True
    
    def test_deactivate_users_action(self):
        """Test deactivate_users bulk action"""
        request = self.factory.post('/admin/accounts/user/')
        request.user = self.superuser
        
        queryset = User.objects.filter(id=self.user.id)
        self.admin.deactivate_users(request, queryset)
        
        self.user.refresh_from_db()
        assert self.user.is_active is False
    
    def test_reset_mfa_action(self):
        """Test reset_mfa bulk action"""
        request = self.factory.post('/admin/accounts/user/')
        request.user = self.superuser
        
        # Enable MFA first
        self.user.is_mfa_enabled = True
        self.user.mfa_code = '123456'
        self.user.save()
        
        queryset = User.objects.filter(id=self.user.id)
        self.admin.reset_mfa(request, queryset)
        
        self.user.refresh_from_db()
        assert self.user.is_mfa_enabled is False
        assert self.user.mfa_code is None
    
    @patch('accounts.admin.send_mail')
    def test_invite_user_view_get(self, mock_send_mail):
        """Test GET request to invite user view"""
        request = self.factory.get('/admin/accounts/user/invite/')
        request.user = self.superuser
        
        response = self.admin.invite_user_view(request)
        assert response.status_code == 200
    
    @patch('accounts.admin.send_mail')
    def test_invite_user_view_post_success(self, mock_send_mail):
        """Test successful POST to invite user view"""
        request = self.factory.post('/admin/accounts/user/invite/', {
            'email': 'newuser@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'job_title': 'Developer',
            'send_email': True
        })
        request.user = self.superuser
        
        # Mock messages framework
        from django.contrib.messages.storage.fallback import FallbackStorage
        setattr(request, 'session', {})
        setattr(request, '_messages', FallbackStorage(request))
        
        response = self.admin.invite_user_view(request)
        
        # Check user was created
        assert User.objects.filter(email='newuser@example.com').exists()
        
        # Check email was attempted to be sent
        mock_send_mail.assert_called_once()
    
    def test_invite_user_view_post_duplicate_email(self):
        """Test POST with duplicate email"""
        request = self.factory.post('/admin/accounts/user/invite/', {
            'email': self.user.email,  # Existing email
            'first_name': 'New',
            'last_name': 'User',
            'send_email': False
        })
        request.user = self.superuser
        
        # Mock messages framework
        from django.contrib.messages.storage.fallback import FallbackStorage
        setattr(request, 'session', {})
        setattr(request, '_messages', FallbackStorage(request))
        
        response = self.admin.invite_user_view(request)
        assert response.status_code == 200  # Returns form with error
    
    def test_storage_report_view(self):
        """Test storage report view"""
        request = self.factory.get('/admin/accounts/user/storage-report/')
        request.user = self.superuser
        
        response = self.admin.storage_report_view(request)
        assert response.status_code == 200
        assert 'users_storage' in response.context_data
        assert 'total_storage' in response.context_data


@pytest.mark.django_db
class TestInviteUserForm:
    """Test cases for InviteUserForm"""
    
    def test_form_valid_data(self):
        """Test form with valid data"""
        form_data = {
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'job_title': 'Developer',
            'send_email': True
        }
        form = InviteUserForm(data=form_data)
        assert form.is_valid()
    
    def test_form_missing_email(self):
        """Test form without required email"""
        form_data = {
            'first_name': 'Test',
            'last_name': 'User'
        }
        form = InviteUserForm(data=form_data)
        assert not form.is_valid()
        assert 'email' in form.errors
    
    def test_form_invalid_email(self):
        """Test form with invalid email"""
        form_data = {
            'email': 'invalid-email',
            'first_name': 'Test'
        }
        form = InviteUserForm(data=form_data)
        assert not form.is_valid()
        assert 'email' in form.errors
    
    def test_form_optional_fields(self):
        """Test form with only required fields"""
        form_data = {
            'email': 'test@example.com'
        }
        form = InviteUserForm(data=form_data)
        assert form.is_valid()
        assert form.cleaned_data['send_email'] is True  # Default value
