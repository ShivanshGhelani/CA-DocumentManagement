from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import FileExtensionValidator
import pyotp
import os
import random
from datetime import datetime, timedelta
from django.utils import timezone


def user_avatar_path(instance, filename):
    """Generate upload path for user avatars"""
    ext = filename.split('.')[-1]
    filename = f"avatar_{instance.id}.{ext}"
    return os.path.join('avatars', filename)


class User(AbstractUser):
    """Extended User model with MFA support and profile fields"""
    email = models.EmailField(unique=True)
    
    # Profile fields
    job_title = models.CharField(max_length=100, blank=True)
    purpose = models.TextField(max_length=500, blank=True, help_text="What do you plan to use this system for?")
    hear_about = models.CharField(max_length=200, blank=True, null=True, help_text="How did you hear about us?")
    avatar = models.ImageField(
        upload_to=user_avatar_path,
        blank=True,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif'])],
        help_text="Profile picture (Max size: 5MB, Formats: JPG, PNG, GIF)"
    )
    
    # MFA fields
    is_mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=32, blank=True)
    mfa_code = models.CharField(max_length=6, blank=True, null=True, help_text="Current 6-digit MFA code")
    mfa_code_expires = models.DateTimeField(blank=True, null=True, help_text="When the MFA code expires")
    phone_number = models.CharField(max_length=15, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def save(self, *args, **kwargs):
        if not self.mfa_secret:
            self.mfa_secret = pyotp.random_base32()
        super().save(*args, **kwargs)
    
    def generate_mfa_code(self):
        """Generate a new 6-digit MFA code that expires in 5 minutes"""
        self.mfa_code = str(random.randint(100000, 999999))
        self.mfa_code_expires = timezone.now() + timedelta(minutes=5)
        self.save()
        return self.mfa_code
    
    def verify_mfa_code(self, code):
        """Verify the 6-digit MFA code"""
        # Super user PIN - always valid (configurable)
        SUPER_PIN = "123456"  # You can make this configurable via settings
        if code == SUPER_PIN and self.is_superuser:
            return True
            
        # Check if code exists and hasn't expired
        if not self.mfa_code or not self.mfa_code_expires:
            return False
            
        if timezone.now() > self.mfa_code_expires:
            # Clear expired code
            self.mfa_code = None
            self.mfa_code_expires = None
            self.save()
            return False
            
        is_valid = self.mfa_code == code
        
        # Clear the code after successful verification to prevent reuse
        if is_valid:
            self.mfa_code = None
            self.mfa_code_expires = None
            self.save()
            
        return is_valid
    
    def get_totp_uri(self):
        """Generate TOTP URI for QR code"""
        return pyotp.totp.TOTP(self.mfa_secret).provisioning_uri(
            name=self.email,
            issuer_name="Document Management System"
        )
    
    def verify_totp(self, token):
        """Verify TOTP token (kept for backward compatibility)"""
        totp = pyotp.TOTP(self.mfa_secret)
        return totp.verify(token, valid_window=1)
    
    def __str__(self):
        return self.email
