from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count, Sum, Q
from django.urls import path
from django.utils import timezone
from .models import Document, DocumentVersion, Tag, DocumentAccess, DocumentAuditLog


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Enhanced admin configuration for Tag model"""
    list_display = ('display_name_colored', 'key', 'value', 'usage_count', 'created_by', 'created_at')
    list_filter = ('created_at', 'created_by', 'key')
    search_fields = ('key', 'value')
    readonly_fields = ('created_at', 'display_name', 'usage_count')
    
    def display_name_colored(self, obj):
        """Display tag name with color"""
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 6px; border-radius: 3px;">{}</span>',
            obj.color,
            obj.display_name
        )
    display_name_colored.short_description = 'Tag'
    
    def usage_count(self, obj):
        """Display how many documents use this tag"""
        return obj.documents.count()
    usage_count.short_description = 'Usage Count'


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    """Enhanced admin configuration for Document model"""
    list_display = (
        'title', 'status_badge', 'short_id', 'file_info', 'versions_count',
        'created_by', 'storage_usage', 'is_deleted', 'created_at'
    )
    list_filter = (
        'status', 'is_deleted', 'created_at', 'updated_at',
        ('created_by', admin.RelatedOnlyFieldListFilter),
        ('tags', admin.RelatedOnlyFieldListFilter)
    )
    search_fields = ('title', 'description', 'short_id')
    readonly_fields = (
        'id', 'short_id', 'file_info', 'storage_usage', 'versions_count',
        'created_at', 'updated_at', 'tags_display'
    )
    filter_horizontal = ('tags',)
    date_hierarchy = 'created_at'
    list_per_page = 50
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'status', 'short_id')
        }),
        ('File Information', {
            'fields': ('current_version', 'file_info', 'storage_usage', 'versions_count')
        }),
        ('Relationships', {
            'fields': ('created_by', 'tags', 'tags_display')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at', 'deleted_by'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['restore_documents', 'permanent_delete', 'change_status_to_published']

    def status_badge(self, obj):
        """Display status with colored badge"""
        colors = {
            'draft': '#6c757d',
            'published': '#28a745', 
            'archived': '#ffc107'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.status.upper()
        )
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'status'

    def file_info(self, obj):
        """Display file information"""
        if obj.current_version:
            return format_html(
                '<strong>Type:</strong> {}<br><strong>Size:</strong> {}',
                obj.file_type or 'Unknown',
                self.format_file_size(obj.file_size) if obj.file_size else 'Unknown'
            )
        return "No file"
    file_info.short_description = 'File Info'

    def versions_count(self, obj):
        """Display number of versions"""
        count = obj.versions.count()
        return format_html(
            '<a href="/admin/documents/documentversion/?document__id__exact={}">{} versions</a>',
            obj.id,
            count
        )
    versions_count.short_description = 'Versions'

    def storage_usage(self, obj):
        """Display storage usage for this document"""
        total_size = obj.versions.aggregate(total=Sum('file_size'))['total'] or 0
        return self.format_file_size(total_size)
    storage_usage.short_description = 'Storage Used'

    def tags_display(self, obj):
        """Display tags with colors"""
        if obj.tags.exists():
            tags_html = []
            for tag in obj.tags.all():
                tags_html.append(
                    format_html(
                        '<span style="background-color: {}; color: white; padding: 1px 4px; border-radius: 2px; margin-right: 2px; font-size: 10px;">{}</span>',
                        tag.color,
                        tag.display_name
                    )
                )
            return format_html(''.join(tags_html))
        return "No tags"
    tags_display.short_description = 'Tags'

    def format_file_size(self, size):
        """Format file size in human readable format"""
        if size > 1024 * 1024 * 1024:  # GB
            return f"{size / (1024 * 1024 * 1024):.1f} GB"
        elif size > 1024 * 1024:  # MB
            return f"{size / (1024 * 1024):.1f} MB"
        elif size > 1024:  # KB
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size} B"

    def restore_documents(self, request, queryset):
        """Bulk action to restore soft-deleted documents"""
        restored = 0
        for doc in queryset.filter(is_deleted=True):
            doc.restore()
            restored += 1
        
        self.message_user(
            request,
            f'Successfully restored {restored} document(s).',
            level='SUCCESS'
        )
    restore_documents.short_description = "Restore selected documents"

    def permanent_delete(self, request, queryset):
        """Bulk action to permanently delete documents"""
        count = queryset.count()
        queryset.delete()
        self.message_user(
            request,
            f'Permanently deleted {count} document(s).',
            level='WARNING'
        )
    permanent_delete.short_description = "Permanently delete selected documents"

    def change_status_to_published(self, request, queryset):
        """Bulk action to publish documents"""
        updated = queryset.update(status='published')
        self.message_user(
            request,
            f'Successfully published {updated} document(s).',
            level='SUCCESS'
        )
    change_status_to_published.short_description = "Publish selected documents"


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    """Enhanced admin configuration for DocumentVersion model"""
    list_display = (
        'document_title', 'version_number', 'file_info', 'created_by', 'created_at'
    )
    list_filter = (
        'created_at', 'file_type',
        ('created_by', admin.RelatedOnlyFieldListFilter),
        ('document', admin.RelatedOnlyFieldListFilter)
    )
    search_fields = ('document__title', 'title', 'description', 'changes_description')
    readonly_fields = ('id', 'file_size', 'file_type', 'created_at')
    
    fieldsets = (
        ('Version Information', {
            'fields': ('document', 'version_number', 'title', 'description')
        }),
        ('File Information', {
            'fields': ('file', 'file_size', 'file_type')
        }),
        ('Changes', {
            'fields': ('changes_description', 'reason')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at'),
            'classes': ('collapse',)
        }),
    )

    def document_title(self, obj):
        """Display document title with link"""
        return format_html(
            '<a href="/admin/documents/document/{}/change/">{}</a>',
            obj.document.id,
            obj.document.title
        )
    document_title.short_description = 'Document'
    document_title.admin_order_field = 'document__title'

    def file_info(self, obj):
        """Display file information"""
        return format_html(
            '<strong>Type:</strong> {}<br><strong>Size:</strong> {}',
            obj.file_type or 'Unknown',
            self.format_file_size(obj.file_size) if obj.file_size else 'Unknown'
        )
    file_info.short_description = 'File Info'

    def format_file_size(self, size):
        """Format file size in human readable format"""
        if size > 1024 * 1024 * 1024:  # GB
            return f"{size / (1024 * 1024 * 1024):.1f} GB"
        elif size > 1024 * 1024:  # MB
            return f"{size / (1024 * 1024):.1f} MB"
        elif size > 1024:  # KB
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size} B"


@admin.register(DocumentAccess)
class DocumentAccessAdmin(admin.ModelAdmin):
    """Admin configuration for DocumentAccess model"""
    list_display = ('document', 'user', 'permission_badge', 'granted_by', 'granted_at')
    list_filter = ('permission', 'granted_at')
    search_fields = ('document__title', 'user__email', 'granted_by__email')
    
    def permission_badge(self, obj):
        """Display permission with colored badge"""
        colors = {
            'read': '#007bff',
            'write': '#ffc107',
            'admin': '#dc3545'
        }
        color = colors.get(obj.permission, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.permission.upper()
        )
    permission_badge.short_description = 'Permission'
    permission_badge.admin_order_field = 'permission'


@admin.register(DocumentAuditLog)
class DocumentAuditLogAdmin(admin.ModelAdmin):
    """Admin configuration for DocumentAuditLog model"""
    list_display = ('document', 'action_badge', 'performed_by', 'timestamp')
    list_filter = ('action', 'timestamp')
    search_fields = ('document__title', 'performed_by__email', 'details')
    readonly_fields = ('document', 'version', 'action', 'performed_by', 'details', 'timestamp')
    
    def action_badge(self, obj):
        """Display action with colored badge"""
        colors = {
            'create': '#28a745',
            'update': '#ffc107', 
            'delete': '#dc3545',
            'rollback': '#6f42c1',
            'download': '#17a2b8',
            'view': '#007bff'
        }
        color = colors.get(obj.action, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.action.upper()
        )
    action_badge.short_description = 'Action'
    action_badge.admin_order_field = 'action'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


