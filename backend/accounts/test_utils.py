import pytest
from django.test import TestCase
from accounts.utils import send_password_reset_email, send_mfa_backup_codes_email
from unittest.mock import patch, Mock
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestAccountsUtils:
    """Test cases for accounts utility functions"""
    
    @patch('accounts.utils.send_mail')
    @patch('accounts.utils.render_to_string')
    def test_send_password_reset_email_success(self, mock_render, mock_send_mail):
        """Test successful password reset email sending"""
        user = User.objects.create_user(
            username='test',
            email='test@example.com',
            password='pass123',
            first_name='Test'
        )
        
        mock_render.return_value = '<html>Reset Email</html>'
        mock_send_mail.return_value = True
        
        result = send_password_reset_email(user, 'reset-token-123')
        
        assert result is True
        mock_send_mail.assert_called_once()
        
        # Check email parameters
        call_args = mock_send_mail.call_args[1]
        assert 'Reset Your Password' in call_args['subject']
        assert 'test@example.com' in call_args['recipient_list']
        assert 'reset-token-123' in call_args['message']
    
    @patch('accounts.utils.send_mail')
    def test_send_password_reset_email_failure(self, mock_send_mail):
        """Test password reset email sending failure"""
        user = User.objects.create_user(
            username='test',
            email='test@example.com',
            password='pass123'
        )
        
        mock_send_mail.side_effect = Exception('SMTP Error')
        result = send_password_reset_email(user, 'reset-token-123')
        
        assert result is False
    
    @patch('accounts.utils.send_mail')
    @patch('accounts.utils.render_to_string')
    def test_send_mfa_backup_codes_email_success(self, mock_render, mock_send_mail):
        """Test successful MFA backup codes email sending"""
        user = User.objects.create_user(
            username='test',
            email='test@example.com',
            password='pass123',
            first_name='Test'
        )
        
        backup_codes = ['123456', '234567', '345678']
        
        mock_render.return_value = '<html>Backup Codes</html>'
        mock_send_mail.return_value = True
        
        result = send_mfa_backup_codes_email(user, backup_codes)
        
        assert result is True
        mock_send_mail.assert_called_once()
        
        # Check email parameters
        call_args = mock_send_mail.call_args[1]
        assert 'MFA Backup Codes' in call_args['subject']
        assert 'test@example.com' in call_args['recipient_list']
        assert '123456' in call_args['message']
        assert '234567' in call_args['message']
    
    @patch('accounts.utils.send_mail')
    def test_send_mfa_backup_codes_email_failure(self, mock_send_mail):
        """Test MFA backup codes email sending failure"""
        user = User.objects.create_user(
            username='test',
            email='test@example.com',
            password='pass123'
        )
        
        backup_codes = ['123456', '234567']
        
        mock_send_mail.side_effect = Exception('SMTP Error')
        result = send_mfa_backup_codes_email(user, backup_codes)
        
        assert result is False
    
    @patch('accounts.utils.send_mail')
    @patch('accounts.utils.render_to_string')
    def test_send_password_reset_email_user_without_first_name(self, mock_render, mock_send_mail):
        """Test password reset email for user without first name"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='pass123'
        )
        
        mock_render.return_value = '<html>Reset Email</html>'
        mock_send_mail.return_value = True
        
        result = send_password_reset_email(user, 'reset-token-123')
        
        assert result is True
        # Check that username is used when first_name is not available
        call_args = mock_send_mail.call_args[1]
        assert 'testuser' in call_args['message']
