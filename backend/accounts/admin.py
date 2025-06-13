from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for User model"""
    list_display = ('email', 'username', 'first_name', 'last_name', 'is_mfa_enabled', 'is_staff', 'is_active', 'created_at')
    list_filter = ('is_staff', 'is_active', 'is_mfa_enabled', 'created_at')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'mfa_secret')
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('phone_number', 'is_mfa_enabled', 'mfa_secret', 'created_at', 'updated_at')
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('email', 'phone_number')
        }),
    )
