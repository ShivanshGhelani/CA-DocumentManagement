from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.text import slugify
import uuid
import os
import shortuuid

User = get_user_model()

def document_upload_path(instance, filename):
    """
    Upload path for original file:
    documents/{user_email}/{short_id}/original/{uuid}.{ext}
    """
    ext = filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{ext}"

    user_email = str(instance.created_by.email).replace("@", "_at_").replace(".", "_")
    document_folder = f"{instance.short_id}"

    return f"documents/{user_email}/{document_folder}/{unique_filename}"

# New: versioned upload path for DocumentVersion

def document_version_upload_path(instance, filename):
    """
    Upload path for versioned files:
    documents/{user_email}/{short_id}/versions/{version_number}/{filename}
    """
    user_email = str(instance.created_by.email).replace("@", "_at_").replace(".", "_")
    document_folder = f"{instance.document.short_id}"
    version_number = str(getattr(instance, 'version_number', 'unknown'))  # fallback if not set
    return f"documents/{user_email}/{document_folder}/versions/{version_number}/{filename}"



class DocumentManager(models.Manager):
    """Custom manager for Document model with soft delete support"""
    
    def get_queryset(self):
        """Return only non-deleted documents by default"""
        return super().get_queryset().filter(is_deleted=False)
    
    def all_with_deleted(self):
        """Return all documents including deleted ones"""
        return super().get_queryset()
    
    def deleted_only(self):
        """Return only deleted documents"""
        return super().get_queryset().filter(is_deleted=True)


class Tag(models.Model):
    """Tag model for document categorization with key-value support"""
    key = models.CharField(max_length=50, help_text="Tag key/name (required)")
    value = models.CharField(max_length=100, blank=True, help_text="Tag value (optional)")
    color = models.CharField(max_length=7, default='#007bff')  # Hex color
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tags')
    
    class Meta:
        ordering = ['key', 'value']
        unique_together = ['key', 'value', 'created_by']  # Same user can't have duplicate key-value pairs
    
    def __str__(self):
        if self.value:
            return f"{self.key}: {self.value}"
        return self.key
    
    @property
    def display_name(self):
        """Display name for the tag"""
        if self.value:
            return f"{self.key}: {self.value}"
        return self.key


class Document(models.Model):
    """Main document model"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    short_id = models.CharField(max_length=12, unique=True, editable=False, blank=True, help_text="Short, unique, human-friendly document ID")
    title = models.CharField(max_length=100)  # Updated max length to 100
    description = models.TextField(blank=True)
    content = models.TextField(blank=True, help_text="Document content (optional if file is provided)")
    file = models.FileField(
        upload_to=document_upload_path,
        blank=True,  # Made optional since content can be provided instead
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'docx', 'txt'])]
    )
    file_size = models.PositiveIntegerField(null=True, blank=True)  # in bytes, optional now
    file_type = models.CharField(max_length=10, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    version = models.PositiveIntegerField(default=1)
    
    # Relationships
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    tags = models.ManyToManyField(Tag, blank=True, related_name='documents')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='deleted_documents'
    )
      # Custom manager
    objects = DocumentManager()
    
    class Meta:
        ordering = ['-updated_at']
        unique_together = ['title', 'created_by']

    def soft_delete(self, user):
        """Soft delete the document"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save()

    def restore(self):
        """Restore a soft-deleted document"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()

    def save(self, *args, **kwargs):
        if not self.short_id:
            # Get initials from full name, fallback to username/email
            full_name = self.created_by.get_full_name()
            if full_name:
                initials = ''.join([part[0].upper() for part in full_name.split() if part])
            else:
                username = getattr(self.created_by, 'username', None)
                if username:
                    initials = ''.join([part[0].upper() for part in username.split() if part])
                else:
                    email = getattr(self.created_by, 'email', '')
                    initials = ''.join([part[0].upper() for part in email.split('@')[0].split('.') if part])
            # Find the highest existing doc number for this user
            existing_ids = Document.objects.filter(created_by=self.created_by, short_id__startswith=initials + 'D').values_list('short_id', flat=True)
            max_num = 0
            for sid in existing_ids:
                try:
                    num = int(sid[len(initials)+1:])
                    if num > max_num:
                        max_num = num
                except (ValueError, IndexError):
                    continue
            next_number = max_num + 1
            self.short_id = f"{initials}D{next_number:03d}"
        if self.file:
            try:
                self.file_size = self.file.size
                self.file_type = self.file.name.split('.')[-1].lower()
            except FileNotFoundError:
                self.file_size = None
                self.file_type = None
        super().save(*args, **kwargs)
    
    def clean(self):
        """Model-level validation to ensure either content or file is provided"""
        if not self.content and not self.file:
            raise ValidationError("Either content or file must be provided.")
        
        # Validate file size if file is provided
        if self.file and self.file.size > 10 * 1024 * 1024:  # 10MB limit
            raise ValidationError("File size cannot exceed 10MB.")

    def __str__(self):
        return f"{self.title} (v{self.version})"


class DocumentVersion(models.Model):
    """Document version history"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to=document_version_upload_path)
    file_size = models.PositiveIntegerField()
    changes_description = models.TextField(blank=True)
    reason = models.CharField(max_length=255, blank=True, help_text="Reason for uploading this version")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-version_number']
        unique_together = ['document', 'version_number']
    
    def save(self, *args, **kwargs):
        if self.file:
            self.file_size = self.file.size
        if self.reason and not self.changes_description:
            self.changes_description = self.reason
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
