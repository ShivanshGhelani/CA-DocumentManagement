from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count, Q
from django.urls import path
from django.utils import timezone
from datetime import timedelta
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Enhanced admin configuration for AuditLog model"""
    list_display = (
        'user_email', 'action_badge', 'resource_info', 'ip_address', 
        'timestamp_formatted', 'details_summary'
    )
    list_filter = (
        'action', 'resource_type', 'timestamp',
        ('user', admin.RelatedOnlyFieldListFilter),
        ('timestamp', admin.DateFieldListFilter),
    )
    search_fields = ('user__email', 'resource_name', 'ip_address', 'details')
    readonly_fields = (
        'id', 'user', 'action', 'resource_type', 'resource_id', 
        'resource_name', 'details_formatted', 'ip_address', 'user_agent', 
        'timestamp', 'content_object'
    )
    
    date_hierarchy = 'timestamp'
    list_per_page = 50
    ordering = ('-timestamp',)
    
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'ip_address', 'user_agent')
        }),
        ('Action Details', {
            'fields': ('action', 'resource_type', 'resource_id', 'resource_name', 'content_object')
        }),
        ('Additional Information', {
            'fields': ('details_formatted', 'timestamp'),
            'classes': ('collapse',)
        }),
    )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'analytics/',
                self.admin_site.admin_view(self.analytics_view),
                name='audit_auditlog_analytics',
            ),
        ]
        return custom_urls + urls

    def user_email(self, obj):
        """Display user email with link"""
        if obj.user:
            return format_html(
                '<a href="/admin/accounts/user/{}/change/">{}</a>',
                obj.user.id,
                obj.user.email
            )
        return "Anonymous"
    user_email.short_description = 'User'
    user_email.admin_order_field = 'user__email'

    def action_badge(self, obj):
        """Display action with colored badge"""
        colors = {
            'create': '#28a745',    # Green
            'read': '#007bff',      # Blue  
            'update': '#ffc107',    # Yellow
            'delete': '#dc3545',    # Red
            'login': '#17a2b8',     # Cyan
            'logout': '#6c757d',    # Gray
            'download': '#6f42c1',  # Purple
            'share': '#20c997',     # Teal
            'upload': '#fd7e14',    # Orange
        }
        color = colors.get(obj.action, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.action.upper()
        )
    action_badge.short_description = 'Action'
    action_badge.admin_order_field = 'action'

    def resource_info(self, obj):
        """Display resource information"""
        return format_html(
            '<strong>{}</strong><br><small>{}</small>',
            obj.resource_name or f"{obj.resource_type} #{obj.resource_id}",
            obj.resource_type
        )
    resource_info.short_description = 'Resource'

    def timestamp_formatted(self, obj):
        """Display formatted timestamp"""
        return obj.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    timestamp_formatted.short_description = 'Date/Time'
    timestamp_formatted.admin_order_field = 'timestamp'

    def details_summary(self, obj):
        """Display truncated details"""
        if obj.details:
            details_str = str(obj.details)
            if len(details_str) > 50:
                return f"{details_str[:50]}..."
            return details_str
        return "-"
    details_summary.short_description = 'Details'

    def details_formatted(self, obj):
        """Display formatted details for detail view"""
        if obj.details:
            import json
            try:
                if isinstance(obj.details, dict):
                    return format_html('<pre>{}</pre>', json.dumps(obj.details, indent=2))
                else:
                    return format_html('<pre>{}</pre>', str(obj.details))
            except:
                return str(obj.details)
        return "No details"
    details_formatted.short_description = 'Details'

    def has_add_permission(self, request):
        """Prevent manual creation of audit logs"""
        return False

    def has_change_permission(self, request, obj=None):
        """Prevent editing of audit logs"""
        return False

    def has_delete_permission(self, request, obj=None):
        """Allow deletion only for superusers and only old logs"""
        if not request.user.is_superuser:
            return False
        if obj and obj.timestamp > timezone.now() - timedelta(days=30):
            return False  # Prevent deletion of recent logs
        return True

    def get_queryset(self, request):
        """Optimize queryset"""
        return super().get_queryset(request).select_related('user')

    def analytics_view(self, request):
        """Custom analytics view for audit logs"""
        from django.template.response import TemplateResponse
        
        # Calculate statistics
        total_logs = AuditLog.objects.count()
        
        # Recent activity (last 7 days)
        recent_logs = AuditLog.objects.filter(
            timestamp__gte=timezone.now() - timedelta(days=7)
        ).count()
        
        # Most active users
        active_users = AuditLog.objects.values(
            'user__email'
        ).annotate(
            log_count=Count('id')
        ).order_by('-log_count')[:10]
        
        # Action distribution
        action_stats = AuditLog.objects.values(
            'action'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Resource type distribution
        resource_stats = AuditLog.objects.values(
            'resource_type'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Daily activity (last 30 days)
        from django.db.models import TruncDate
        daily_activity = AuditLog.objects.filter(
            timestamp__gte=timezone.now() - timedelta(days=30)
        ).extra(
            select={'day': 'date(timestamp)'}
        ).values('day').annotate(
            count=Count('id')
        ).order_by('day')
        
        context = {
            'title': 'Audit Log Analytics',
            'total_logs': total_logs,
            'recent_logs': recent_logs,
            'active_users': active_users,
            'action_stats': action_stats,
            'resource_stats': resource_stats,
            'daily_activity': daily_activity,
            'opts': self.model._meta,
        }
        
        return TemplateResponse(request, 'admin/audit/analytics.html', context)
