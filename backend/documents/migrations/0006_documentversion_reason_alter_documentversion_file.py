# Generated by Django 4.2.22 on 2025-07-03 03:35

from django.db import migrations, models
import documents.models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0005_document_content_alter_document_file_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='documentversion',
            name='reason',
            field=models.CharField(blank=True, help_text='Reason for uploading this version', max_length=255),
        ),
        migrations.AlterField(
            model_name='documentversion',
            name='file',
            field=models.FileField(upload_to=documents.models.document_version_upload_path),
        ),
    ]
