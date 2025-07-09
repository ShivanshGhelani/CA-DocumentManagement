from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.urls import path, reverse
from django.http import HttpResponseRedirect
from django.contrib import messages
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.shortcuts import render
from django import forms
from .models import User


class InviteUserForm(forms.Form):
    """Form for inviting users"""
    email = forms.EmailField(
        label='Email Address',
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'user@example.com'})
    )
    first_name = forms.CharField(
        max_length=30,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'First Name'})
    )
    last_name = forms.CharField(
        max_length=30,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Last Name'})
    )
    job_title = forms.CharField(
        max_length=100,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Job Title'})
    )
    send_email = forms.BooleanField(
        initial=True,
        required=False,
        help_text="Send invitation email to the user"
    )


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Enhanced admin configuration for User model with management features"""
    list_display = (
        'email', 'username', 'full_name', 'is_mfa_enabled', 
        'is_staff', 'is_active', 'documents_count', 'storage_usage',
        'last_login', 'created_at', 'user_actions'
    )
    list_filter = (
        'is_staff', 'is_active', 'is_mfa_enabled', 'created_at', 
        'last_login', 'job_title'
    )
    search_fields = ('email', 'username', 'first_name', 'last_name', 'job_title')
    ordering = ('-created_at',)
    readonly_fields = (
        'created_at', 'updated_at', 'mfa_secret',
        'documents_count', 'storage_usage', 'recent_activity'
    )
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile Information', {
            'fields': ('job_title', 'purpose', 'hear_about', 'phone_number', 'avatar')
        }),
        ('MFA Settings', {
            'fields': ('is_mfa_enabled', 'mfa_secret', 'mfa_backup_codes')
        }),
        ('Statistics', {
            'fields': ('documents_count', 'storage_usage', 'recent_activity'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Profile Information', {
            'fields': ('job_title', 'purpose', 'hear_about', 'phone_number')
        }),
    )
    
    actions = ['activate_users', 'deactivate_users', 'reset_mfa']

    def get_urls(self):
        """Add custom URLs for admin actions"""
        urls = super().get_urls()
        custom_urls = [
            path('invite/', self.invite_user_view, name='accounts_user_invite'),
            path('storage-report/', self.storage_report_view, name='accounts_user_storage_report'),
        ]
        return custom_urls + urls

    def invite_user_view(self, request):
        """Custom view for inviting users"""
        if request.method == 'POST':
            form = InviteUserForm(request.POST)
            if form.is_valid():
                email = form.cleaned_data['email']
                first_name = form.cleaned_data['first_name']
                last_name = form.cleaned_data['last_name']
                job_title = form.cleaned_data['job_title']
                send_email = form.cleaned_data['send_email']
                
                # Check if user already exists
                if User.objects.filter(email=email).exists():
                    messages.error(request, f'User with email {email} already exists.')
                    return render(request, 'admin/accounts/invite_user.html', {'form': form})
                
                # Create user with temporary password
                import secrets
                import string
                temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
                
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    job_title=job_title,
                    password=temp_password,
                    is_active=True
                )
                
                # Send invitation email if requested
                if send_email:
                    try:
                        subject = 'Invitation to Document Management System'
                        message = render_to_string('admin/accounts/invite_email.html', {
                            'user': user,
                            'temp_password': temp_password,
                            'admin_user': request.user,
                            'site_url': request.build_absolute_uri('/'),
                        })
                        
                        send_mail(
                            subject,
                            message,
                            settings.DEFAULT_FROM_EMAIL,
                            [email],
                            fail_silently=False,
                        )
                        messages.success(request, f'User {email} invited successfully and email sent.')
                    except Exception as e:
                        messages.warning(request, f'User {email} created but email failed to send: {str(e)}')
                else:
                    messages.success(request, f'User {email} invited successfully. Temporary password: {temp_password}')
                
                return HttpResponseRedirect(reverse('admin:accounts_user_changelist'))
        else:
            form = InviteUserForm()
        
        return render(request, 'admin/accounts/invite_user.html', {'form': form})

    def full_name(self, obj):
        """Display full name"""
        return obj.get_full_name() or obj.username
    full_name.short_description = 'Full Name'

    def documents_count(self, obj):
        """Display number of documents created by user"""
        count = getattr(obj, '_documents_count', None)
        if count is None:
            count = obj.documents.filter(is_deleted=False).count()
        return count
    documents_count.short_description = 'Documents'
    documents_count.admin_order_field = 'documents_count'

    def storage_usage(self, obj):
        """Display storage usage by user"""
        # Calculate storage from document versions
        from documents.models import DocumentVersion
        total_size = DocumentVersion.objects.filter(
            document__created_by=obj
        ).aggregate(
            total=Sum('file_size')
        )['total'] or 0
        
        # Format size
        if total_size > 1024 * 1024 * 1024:  # GB
            size_str = f"{total_size / (1024 * 1024 * 1024):.1f} GB"
        elif total_size > 1024 * 1024:  # MB
            size_str = f"{total_size / (1024 * 1024):.1f} MB"
        elif total_size > 1024:  # KB
            size_str = f"{total_size / 1024:.1f} KB"
        else:
            size_str = f"{total_size} B"
            
        return size_str
    storage_usage.short_description = 'Storage Used'

    def recent_activity(self, obj):
        """Display recent activity summary"""
        from audit.models import AuditLog
        recent_logs = AuditLog.objects.filter(
            user=obj,
            timestamp__gte=timezone.now() - timedelta(days=7)
        ).count()
        return f"{recent_logs} actions (7 days)"
    recent_activity.short_description = 'Recent Activity'

    def user_actions(self, obj):
        """Display action buttons for user management"""
        actions = []
        
        if obj.is_active:
            actions.append(
                f'<a class="button" href="#" onclick="deactivateUser({obj.pk})">Deactivate</a>'
            )
        else:
            actions.append(
                f'<a class="button" href="#" onclick="activateUser({obj.pk})">Activate</a>'
            )
            
        actions.append(
            f'<a class="button" href="#" onclick="sendInvitation({obj.pk})">Send Invitation</a>'
        )
        
        if obj.is_mfa_enabled:
            actions.append(
                f'<a class="button" href="#" onclick="resetMFA({obj.pk})">Reset MFA</a>'
            )
            
        return format_html(' '.join(actions))
    user_actions.short_description = 'Actions'
    user_actions.allow_tags = True

    def get_queryset(self, request):
        """Optimize queryset with annotations"""
        queryset = super().get_queryset(request)
        queryset = queryset.annotate(
            documents_count=Count('documents', filter=Q(documents__is_deleted=False))
        )
        return queryset

    def activate_users(self, request, queryset):
        """Bulk action to activate users"""
        updated = queryset.update(is_active=True)
        self.message_user(
            request,
            f'Successfully activated {updated} user(s).',
            messages.SUCCESS
        )
    activate_users.short_description = "Activate selected users"

    def deactivate_users(self, request, queryset):
        """Bulk action to deactivate users"""
        updated = queryset.update(is_active=False)
        self.message_user(
            request,
            f'Successfully deactivated {updated} user(s).',
            messages.SUCCESS
        )
    deactivate_users.short_description = "Deactivate selected users"

    def send_invitation(self, request, queryset):
        """Bulk action to send invitations"""
        count = 0
        for user in queryset:
            # Generate invitation token
            token = user.generate_password_reset_token()
            # Here you would normally send an email
            # For now, we'll just create an audit log
            from audit.models import AuditLog
            AuditLog.log_activity(
                user=request.user,
                action='create',
                resource_type='invitation',
                resource_id=user.id,
                resource_name=user.email,
                details={'invitation_token': token},
                request=request
            )
            count += 1
            
        self.message_user(
            request,
            f'Successfully sent invitations to {count} user(s).',
            messages.SUCCESS
        )
    send_invitation.short_description = "Send invitation to selected users"

    def reset_mfa(self, request, queryset):
        """Bulk action to reset MFA for users"""
        updated = queryset.update(
            is_mfa_enabled=False,
            mfa_code=None,
            mfa_code_expires=None,
            mfa_backup_codes=None
        )
        self.message_user(
            request,
            f'Successfully reset MFA for {updated} user(s).',
            messages.SUCCESS
        )
    reset_mfa.short_description = "Reset MFA for selected users"

    def storage_report_view(self, request):
        """Custom view for storage usage report"""
        from django.template.response import TemplateResponse
        from documents.models import DocumentVersion
        
        # Get storage usage per user
        users_storage = User.objects.annotate(
            total_storage=Sum('documents__versions__file_size'),
            document_count=Count('documents', filter=Q(documents__is_deleted=False))
        ).order_by('-total_storage')
        
        # Calculate totals
        total_storage = DocumentVersion.objects.aggregate(
            total=Sum('file_size')
        )['total'] or 0
        
        total_users = User.objects.filter(is_active=True).count()
        
        context = {
            'title': 'Storage Usage Report',
            'users_storage': users_storage,
            'total_storage': total_storage,
            'total_users': total_users,
            'opts': self.model._meta,
        }
        
        return TemplateResponse(request, 'admin/accounts/storage_report.html', context)
