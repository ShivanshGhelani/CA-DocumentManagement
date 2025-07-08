# Generated migration for document versioning system

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid
import documents.models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('documents', '0007_document_short_id'),
    ]

    operations = [
        # Create DocumentVersion model
        migrations.CreateModel(
            name='DocumentVersion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('version_number', models.PositiveIntegerField()),
                ('title', models.CharField(help_text='Title for this version', max_length=100)),
                ('description', models.TextField(blank=True, help_text='Description for this version')),
                ('file', models.FileField(upload_to=documents.models.document_version_upload_path, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg'])])),
                ('file_size', models.PositiveIntegerField()),
                ('file_type', models.CharField(blank=True, max_length=10)),
                ('changes_description', models.TextField(blank=True, help_text='Description of changes made in this version')),
                ('reason', models.CharField(blank=True, help_text='Reason for uploading this version', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ('tags', models.ManyToManyField(blank=True, related_name='document_versions', to='documents.Tag')),
            ],
            options={
                'ordering': ['-version_number'],
            },
        ),
        
        # Create DocumentAuditLog model
        migrations.CreateModel(
            name='DocumentAuditLog',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete'), ('rollback', 'Rollback'), ('download', 'Download'), ('view', 'View')], max_length=20)),
                ('details', models.TextField(blank=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('performed_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
        
        # Create DocumentAccess model
        migrations.CreateModel(
            name='DocumentAccess',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('permission', models.CharField(choices=[('read', 'Read'), ('write', 'Write'), ('admin', 'Admin')], max_length=10)),
                ('granted_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='document_permissions', to=settings.AUTH_USER_MODEL)),
                ('granted_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='granted_permissions', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        
        # Add foreign key relationships to DocumentVersion after Document is ready
        migrations.AddField(
            model_name='documentversion',
            name='document',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='documents.Document'),
        ),
        
        # Add foreign key relationships to DocumentAuditLog
        migrations.AddField(
            model_name='documentauditlog',
            name='document',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to='documents.Document'),
        ),
        migrations.AddField(
            model_name='documentauditlog',
            name='version',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to='documents.DocumentVersion'),
        ),
        
        # Add foreign key relationships to DocumentAccess
        migrations.AddField(
            model_name='documentaccess',
            name='document',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access_permissions', to='documents.Document'),
        ),
        
        # Add current_version field to Document
        migrations.AddField(
            model_name='document',
            name='current_version',
            field=models.ForeignKey(blank=True, help_text='Points to the currently active version', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='documents_pointing_to_this_version', to='documents.DocumentVersion'),
        ),
        
        # Add unique constraints
        migrations.AlterUniqueTogether(
            name='documentversion',
            unique_together={('document', 'version_number')},
        ),
        migrations.AlterUniqueTogether(
            name='documentaccess',
            unique_together={('document', 'user')},
        ),
    ]
