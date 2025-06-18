from django.contrib import admin
from .models import Document, DocumentVersion, Tag, DocumentAccess


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
    list_display = ('title', 'status', 'file_type', 'version', 'created_by', 'created_at', 'updated_at')
    list_filter = ('status', 'file_type', 'created_at', 'created_by')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'file_size', 'file_type', 'version', 'created_at', 'updated_at')
    filter_horizontal = ('tags',)
    
    fieldsets = (
        (None, {
            'fields': ('id', 'title', 'description', 'status')
        }),
        ('File Info', {
            'fields': ('file', 'file_size', 'file_type', 'version')
        }),
        ('Relationships', {
            'fields': ('created_by', 'tags')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


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
