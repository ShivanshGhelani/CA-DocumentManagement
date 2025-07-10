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
    """Main document model with pointer-based versioning"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    short_id = models.CharField(max_length=12, unique=True, editable=False, blank=True, help_text="Short, unique, human-friendly document ID")
    
    # Basic metadata (can be updated independently of versions)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    
    # Versioning - pointer to current active version
    current_version = models.ForeignKey(
        'DocumentVersion', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='documents_pointing_to_this_version',
        help_text="Points to the currently active version"
    )
    
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

    def rollback_to_version(self, version_id, user):
        """Rollback document to a specific version (owner only)"""
        # Check if user is the owner
        if self.created_by != user:
            return False, "Only the document owner can rollback versions"
            
        try:
            version = self.versions.get(id=version_id)
            self.current_version = version
            self.updated_at = timezone.now()
            self.save()
            
            # Create audit log for rollback using the main AuditLog
            from audit.models import AuditLog
            AuditLog.log_activity(
                user=user,
                action="rollback",
                resource_type="document",
                resource_id=str(self.id),
                resource_name=self.title,
                details={
                    "version_id": str(version_id),
                    "version_number": version.version_number,
                    "reason": f"Rolled back to version {version.version_number}"
                },
                content_object=self,
            )
            return True, "Successfully rolled back"
        except DocumentVersion.DoesNotExist:
            return False, "Version not found"

    def get_latest_version_number(self):
        """Get the latest version number for this document"""
        latest = self.versions.order_by('-version_number').first()
        return latest.version_number if latest else 0

    def create_new_version(self, file, user, inherit_metadata=True, **metadata):
        """Create a new version of the document (owner only)"""
        # Check if user is the owner
        if self.created_by != user:
            return None, "Only the document owner can create new versions"
            
        latest_version_number = self.get_latest_version_number()
        new_version_number = latest_version_number + 1
        
        # Create new version
        new_version = DocumentVersion.objects.create(
            document=self,
            version_number=new_version_number,
            file=file,
            created_by=user,
            **metadata
        )
        
        # If inheriting metadata, copy from current document
        if inherit_metadata:
            # Copy tags
            new_version.tags.set(self.tags.all())
            # Copy other metadata if not explicitly provided
            if 'title' not in metadata:
                new_version.title = self.title
            if 'description' not in metadata:
                new_version.description = self.description
            new_version.save()
        
        # Update pointer to new version
        self.current_version = new_version
        self.updated_at = timezone.now()
        self.save()
        
        # Create audit log using the main AuditLog
        from audit.models import AuditLog
        AuditLog.log_activity(
            user=user,
            action="create",
            resource_type="document_version",
            resource_id=str(new_version.id),
            resource_name=f"{self.title} v{new_version_number}",
            details={
                "document_id": str(self.id),
                "version_number": new_version_number,
                "reason": metadata.get('reason', '')
            },
            content_object=new_version,
        )
        
        return new_version, "Version created successfully"

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
        super().save(*args, **kwargs)

    def __str__(self):
        version_info = f"v{self.current_version.version_number}" if self.current_version else "no version"
        return f"{self.title} ({version_info})"

    @property
    def file(self):
        """Get file from current version"""
        return self.current_version.file if self.current_version else None
    
    @property
    def file_size(self):
        """Get file size from current version"""
        return self.current_version.file_size if self.current_version else None
    
    @property
    def file_type(self):
        """Get file type from current version"""
        return self.current_version.file_type if self.current_version else None
    
    @property
    def version_number(self):
        """Get current version number"""
        return self.current_version.version_number if self.current_version else None


class DocumentVersion(models.Model):
    """Document version history with full metadata"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    
    # Version-specific metadata
    title = models.CharField(max_length=100, help_text="Title for this version")
    description = models.TextField(blank=True, help_text="Description for this version")
    
    # File information
    file = models.FileField(
        upload_to=document_version_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg'])],
        blank=True, null=True
    )
    file_size = models.PositiveIntegerField(default=0)
    file_type = models.CharField(max_length=10, blank=True)
    
    # Version metadata
    changes_description = models.TextField(blank=True, help_text="Description of changes made in this version")
    reason = models.CharField(max_length=255, blank=True, help_text="Reason for uploading this version")
    
    # Relationships
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    tags = models.ManyToManyField(Tag, blank=True, related_name='document_versions')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-version_number']
        unique_together = ['document', 'version_number']
    
    def save(self, *args, **kwargs):
        if self.file:
            try:
                self.file_size = self.file.size
                self.file_type = self.file.name.split('.')[-1].lower()
            except:
                self.file_size = 0
                self.file_type = ''
        else:
            # Set defaults for versions without files
            if not self.file_size:
                self.file_size = 0
            if not self.file_type:
                self.file_type = ''
                
        if self.reason and not self.changes_description:
            self.changes_description = self.reason
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.document.title} v{self.version_number}"


class DocumentAuditLog(models.Model):
    """Audit log for document actions"""
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('rollback', 'Rollback'),
        ('download', 'Download'),
        ('view', 'View'),
    ]
    
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='audit_logs')
    version = models.ForeignKey(DocumentVersion, on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(User, on_delete=models.CASCADE)
    details = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.action} on {self.document.title} by {self.performed_by.email}"


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
