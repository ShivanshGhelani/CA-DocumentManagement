from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

def send_password_reset_email(user, reset_token):
    """Send password reset email to user"""
    try:
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}&email={user.email}"
        
        context = {
            'user': user,
            'reset_url': reset_url,
            'current_year': timezone.now().year,
        }
        
        html_message = render_to_string('emails/password_reset.html', context)
        
        subject = 'Reset Your Password - Document Management System'
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = [user.email]
        
        send_mail(
            subject=subject,
            message=f'Hello {user.first_name or user.username},\n\n'
                   f'You requested a password reset. Click the link below to reset your password:\n\n'
                   f'{reset_url}\n\n'
                   f'This link will expire in 10 minutes.\n\n'
                   f'If you did not request this reset, please ignore this email.\n\n'
                   f'Document Management System',
            from_email=from_email,
            recipient_list=recipient_list,
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f'Password reset email sent to {user.email}')
        return True
        
    except Exception as e:
        logger.error(f'Failed to send password reset email to {user.email}: {str(e)}')
        return False


def send_mfa_backup_codes_email(user, backup_codes):
    """Send MFA backup codes email to user"""
    try:
        context = {
            'user': user,
            'backup_codes': backup_codes,
            'current_year': timezone.now().year,
        }
        
        html_message = render_to_string('emails/mfa_backup_codes.html', context)
        
        subject = 'Your New MFA Backup Codes - Document Management System'
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = [user.email]
        
        # Create plain text version
        plain_message = f'Hello {user.first_name or user.username},\n\n'
        plain_message += 'You have successfully generated new backup codes for your Two-Factor Authentication (MFA).\n\n'
        plain_message += 'Your new backup codes:\n'
        for i, code in enumerate(backup_codes, 1):
            plain_message += f'{i}. {code}\n'
        plain_message += '\nIMPORTANT:\n'
        plain_message += '- Save these codes in a secure location\n'
        plain_message += '- Each code can only be used once\n'
        plain_message += '- These codes replace any previously generated backup codes\n'
        plain_message += '- Keep them private and never share them with anyone\n\n'
        plain_message += 'Document Management System'
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=recipient_list,
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f'MFA backup codes email sent to {user.email}')
        return True
        
    except Exception as e:
        logger.error(f'Failed to send MFA backup codes email to {user.email}: {str(e)}')
        return False
