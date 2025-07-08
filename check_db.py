import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Check if documents_document table exists and its structure
cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents_document' ORDER BY ordinal_position;")
print('documents_document table structure:')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]}')

print()

# Check if documents_documentversion table exists and its structure  
cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents_documentversion' ORDER BY ordinal_position;")
print('documents_documentversion table structure:')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]}')
