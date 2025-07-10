#!/usr/bin/env python
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from documents.models import Document, DocumentVersion
from s3_file_manager import update_s3_object_tags

print("Testing S3 tag sync functionality...")

# Get a document with a current version that has a file
doc = Document.objects.filter(current_version__file__isnull=False).first()
if doc:
    print(f"Document: {doc.title}")
    print(f"File: {doc.current_version.file.name}")
    
    # Get current tags
    tags_dict = {tag.key: tag.value for tag in doc.tags.all()}
    print(f"Tags: {tags_dict}")
    
    if tags_dict:
        # Test the S3 sync function
        result = update_s3_object_tags(doc.current_version.file.name, tags_dict)
        print(f"S3 sync result: {result}")
    else:
        print("No tags to sync")
else:
    print("No documents with files found for testing")

print("S3 tag sync test completed!")
