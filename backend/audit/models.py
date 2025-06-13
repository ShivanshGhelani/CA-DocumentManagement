from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
import uuid

User = get_user_model()


class AuditLog(models.Model):
    """Audit log for tracking all system activities"""
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('read', 'Read'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('download', 'Download'),
        ('share', 'Share'),
        ('upload', 'Upload'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=50)  # e.g., 'document', 'user', 'tag'
    resource_id = models.CharField(max_length=100)
    resource_name = models.CharField(max_length=255, blank=True)
    
    # Generic foreign key for linking to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.CharField(max_length=100, null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Additional context
    details = models.JSONField(default=dict, blank=True)  # Store additional context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Timestamps
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['resource_type', 'timestamp']),
        ]
    
    def __str__(self):
        user_str = self.user.email if self.user else 'Anonymous'
        return f"{user_str} - {self.action} {self.resource_type} at {self.timestamp}"
    
    @classmethod
    def log_activity(cls, user, action, resource_type, resource_id, resource_name='', 
                    details=None, request=None, content_object=None):
        """Utility method to create audit log entries"""
        audit_data = {
            'user': user,
            'action': action,
            'resource_type': resource_type,
            'resource_id': str(resource_id),
            'resource_name': resource_name,
            'details': details or {},
        }
        
        if content_object:
            audit_data['content_object'] = content_object
        
        if request:
            audit_data['ip_address'] = cls.get_client_ip(request)
            audit_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')
        
        return cls.objects.create(**audit_data)
    
    @staticmethod
    def get_client_ip(request):
        """Extract client IP from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
