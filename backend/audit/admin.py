from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin configuration for AuditLog model"""
    list_display = ('user', 'action', 'resource_type', 'resource_name', 'ip_address', 'timestamp')
    list_filter = ('action', 'resource_type', 'timestamp')
    search_fields = ('user__email', 'resource_name', 'ip_address')
    readonly_fields = ('id', 'user', 'action', 'resource_type', 'resource_id', 
                      'resource_name', 'details', 'ip_address', 'user_agent', 'timestamp')
    
    def has_add_permission(self, request):
        # Prevent manual creation of audit logs
        return False
    
    def has_change_permission(self, request, obj=None):
        # Prevent editing of audit logs
        return False
    
    def has_delete_permission(self, request, obj=None):
        # Allow deletion only for superusers
        return request.user.is_superuser
