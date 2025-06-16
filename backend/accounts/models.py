from django.contrib.auth.models import AbstractUser
from django.db import models
import pyotp


class User(AbstractUser):
    """Extended User model with MFA support"""
    email = models.EmailField(unique=True)
    is_mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=32, blank=True)
    phone_number = models.CharField(max_length=15, blank=True)
    hear_about = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def save(self, *args, **kwargs):
        if not self.mfa_secret:
            self.mfa_secret = pyotp.random_base32()
        super().save(*args, **kwargs)
    
    def get_totp_uri(self):
        """Generate TOTP URI for QR code"""
        return pyotp.totp.TOTP(self.mfa_secret).provisioning_uri(
            name=self.email,
            issuer_name="Document Management System"
        )
    
    def verify_totp(self, token):
        """Verify TOTP token"""
        totp = pyotp.TOTP(self.mfa_secret)
        return totp.verify(token, valid_window=1)
    
    def __str__(self):
        return self.email
