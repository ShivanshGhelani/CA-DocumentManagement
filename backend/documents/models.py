from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import FileExtensionValidator
import uuid
import os

User = get_user_model()


def document_upload_path(instance, filename):
    """Generate upload path for documents"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('documents', str(instance.created_by.id), filename)


class Tag(models.Model):
    """Tag model for document categorization"""
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default='#007bff')  # Hex color
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tags')
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Document(models.Model):
    """Main document model"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(
        upload_to=document_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'doc', 'docx', 'txt'])]
    )
    file_size = models.PositiveIntegerField()  # in bytes
    file_type = models.CharField(max_length=10)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    version = models.PositiveIntegerField(default=1)
    
    # Relationships
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    tags = models.ManyToManyField(Tag, blank=True, related_name='documents')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
        unique_together = ['title', 'created_by']
    
    def save(self, *args, **kwargs):
        if self.file:
            self.file_size = self.file.size
            self.file_type = self.file.name.split('.')[-1].lower()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.title} (v{self.version})"


class DocumentVersion(models.Model):
    """Document version history"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to=document_upload_path)
    file_size = models.PositiveIntegerField()
    changes_description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-version_number']
        unique_together = ['document', 'version_number']
    
    def save(self, *args, **kwargs):
        if self.file:
            self.file_size = self.file.size
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.document.title} v{self.version_number}"


class DocumentAccess(models.Model):
    """Document access permissions"""
    PERMISSION_CHOICES = [
        ('read', 'Read'),
        ('write', 'Write'),
        ('admin', 'Admin'),
    ]
    
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='access_permissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='document_permissions')
    permission = models.CharField(max_length=10, choices=PERMISSION_CHOICES)
    granted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='granted_permissions')
    granted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['document', 'user']
    
    def __str__(self):
        return f"{self.user.email} - {self.document.title} ({self.permission})"
