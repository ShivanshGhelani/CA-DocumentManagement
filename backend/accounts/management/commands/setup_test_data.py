from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from documents.models import Tag, Document
from audit.models import AuditLog
import tempfile
import os

User = get_user_model()


class Command(BaseCommand):
    help = 'Set up test data for development'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='admin@example.com',
            help='Admin user email'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='admin123',
            help='Admin user password'
        )
    
    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        
        # Create superuser if it doesn't exist
        if not User.objects.filter(email=email).exists():
            user = User.objects.create_superuser(
                username='admin',
                email=email,
                password=password,
                first_name='Admin',
                last_name='User'
            )
            self.stdout.write(
                self.style.SUCCESS(f'Superuser created: {email}')
            )
        else:
            user = User.objects.get(email=email)
            self.stdout.write(
                self.style.WARNING(f'Superuser already exists: {email}')
            )
        
        # Create sample tags
        tags_data = [
            {'name': 'Important', 'color': '#dc3545'},
            {'name': 'Work', 'color': '#007bff'},
            {'name': 'Personal', 'color': '#28a745'},
            {'name': 'Archive', 'color': '#6c757d'},
        ]
        
        created_tags = []
        for tag_data in tags_data:
            tag, created = Tag.objects.get_or_create(
                name=tag_data['name'],
                created_by=user,
                defaults={'color': tag_data['color']}
            )
            created_tags.append(tag)
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Tag created: {tag.name}')
                )
        
        # Create a sample document with test content
        sample_content = """# Sample Document

This is a sample document for testing the document management system.

## Features Tested
- Document upload
- Version control
- Tag management
- Access control
- Audit logging

## System Information
- Created by: Test setup command
- Purpose: Development and testing
"""
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(sample_content)
            temp_file_path = f.name
        
        try:
            # Create sample document if it doesn't exist
            if not Document.objects.filter(title='Sample Document', created_by=user).exists():
                with open(temp_file_path, 'rb') as f:
                    from django.core.files import File
                    document = Document.objects.create(
                        title='Sample Document',
                        description='A sample document for testing the document management system',
                        file=File(f, name='sample_document.txt'),
                        created_by=user,
                        status='published'
                    )
                    document.tags.set(created_tags[:2])  # Add first two tags
                    
                    self.stdout.write(
                        self.style.SUCCESS(f'Sample document created: {document.title}')
                    )
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
        
        # Display summary
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSetup completed successfully!\n'
                f'Admin user: {email}\n'
                f'Password: {password}\n'
                f'Tags created: {len(created_tags)}\n'
                f'You can now start the development server and test the API.'
            )
        )
