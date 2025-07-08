from django.contrib import admin
from .models import Document, DocumentVersion, Tag, DocumentAccess, DocumentAuditLog


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Admin configuration for Tag model"""
    list_display = ('key', 'value', 'display_name', 'color', 'created_by', 'created_at')
    list_filter = ('created_at', 'created_by', 'key')
    search_fields = ('key', 'value')
    readonly_fields = ('created_at', 'display_name')
    
    def display_name(self, obj):
        return obj.display_name
    display_name.short_description = 'Display Name'


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    """Admin configuration for Document model"""
    list_display = ('title', 'status', 'get_file_type', 'get_version_number', 'created_by', 'created_at', 'updated_at')
    list_filter = ('status', 'created_at', 'created_by')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'short_id', 'get_file_size', 'get_file_type', 'get_version_number', 'created_at', 'updated_at')
    filter_horizontal = ('tags',)
    
    fieldsets = (
        (None, {
            'fields': ('id', 'short_id', 'title', 'description', 'status')
        }),
        ('Version Info', {
            'fields': ('current_version', 'get_file_size', 'get_file_type', 'get_version_number')
        }),
        ('Relationships', {
            'fields': ('created_by', 'tags')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def get_file_type(self, obj):
        return obj.file_type if obj.file_type else 'N/A'
    get_file_type.short_description = 'File Type'
    
    def get_file_size(self, obj):
        return obj.file_size if obj.file_size else 'N/A'
    get_file_size.short_description = 'File Size'
    
    def get_version_number(self, obj):
        return obj.version_number if obj.version_number else 'N/A'
    get_version_number.short_description = 'Version'


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    """Admin configuration for DocumentVersion model"""
    list_display = ('document', 'version_number', 'file_size', 'created_by', 'created_at')
    list_filter = ('created_at', 'created_by')
    search_fields = ('document__title', 'changes_description')
    readonly_fields = ('id', 'file_size', 'created_at')


@admin.register(DocumentAccess)
class DocumentAccessAdmin(admin.ModelAdmin):
    """Admin configuration for DocumentAccess model"""
    list_display = ('document', 'user', 'permission', 'granted_by', 'granted_at')
    list_filter = ('permission', 'granted_at')
    search_fields = ('document__title', 'user__email', 'user__username')
    readonly_fields = ('granted_at',)


@admin.register(DocumentAuditLog)
class DocumentAuditLogAdmin(admin.ModelAdmin):
    """Admin configuration for DocumentAuditLog model"""
    list_display = ('document', 'action', 'performed_by', 'timestamp', 'version')
    list_filter = ('action', 'timestamp', 'performed_by')
    search_fields = ('document__title', 'performed_by__email', 'details')
    readonly_fields = ('timestamp',)
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
