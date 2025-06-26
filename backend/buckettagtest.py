#!/usr/bin/env python3
"""
S3 File Upload with Tags Script
Upload files to AWS S3 bucket with custom tags and verification
"""

import boto3
import os
import sys
from botocore.exceptions import ClientError, NoCredentialsError
from pathlib import Path
import argparse
import json

# ================== AWS CONFIGURATION VARIABLES ==================
AWS_REGION = 'us-east-1'  # Default region
AWS_ACCESS_KEY_ID = None  # Set your AWS Access Key ID here
AWS_SECRET_ACCESS_KEY = None  # Set your AWS Secret Access Key here
AWS_SESSION_TOKEN = None  # Optional: Set your AWS Session Token here
AWS_PROFILE = None  # Optional: Set your AWS profile name here
# ==================================================================
# ================== HELPER FUNCTIONS ==============================
def get_all_documents_from_cache():
    """
    Mock function to simulate fetching all documents from cache.
    Replace with actual implementation as needed.
    """
    # Example data structure
    return [
        {'id': '1', 'created_by': {'username': 'user1'}},
        {'id': '2', 'created_by': {'username': 'user2'}},
        {'id': '3', 'created_by': {'username': 'user1'}},
        # Add more documents as needed
    ]
def get_current_user():
    """
    Mock function to simulate fetching the current user.
    Replace with actual implementation as needed.
    """
    # Example current user
    return {'username': 'user1', 'id': '1'}  # Replace with actual user fetching logic
def get_document_by_id(doc_id):
    """
    Mock function to simulate fetching a document by ID.
    Replace with actual implementation as needed.
    """
    all_docs = get_all_documents_from_cache()
    for doc in all_docs:
        if doc['id'] == doc_id:
            return doc
    return None  # Document not found
def get_document_created_by(doc_id):
    """
    Mock function to simulate fetching the user who created a document.
    Replace with actual implementation as needed.
    """
    doc = get_document_by_id(doc_id)
    return doc['created_by'] if doc else None

# ================== S3 UPLOADER CLASS ============================
# This class handles S3 file uploads with tagging functionality
# It initializes the S3 client, verifies bucket existence, formats tags,
# and provides methods to upload files with tags either during or after the upload.
# It also includes methods to verify that tags were applied correctly and to list tags for existing objects
# ================================================================


class S3Uploader:
    def __init__(self, region_name=None, access_key=None, secret_key=None, session_token=None, profile_name=None):
        """Initialize S3 client with credentials"""
        try:
            # Use provided parameters or fall back to global variables
            region = region_name or AWS_REGION
            
            # Initialize session with credentials
            session_kwargs = {}
            
            if profile_name or AWS_PROFILE:
                # Use AWS profile
                profile = profile_name or AWS_PROFILE
                session_kwargs['profile_name'] = profile
                print(f"🔑 Using AWS profile: {profile}")
            else:
                # Use explicit credentials
                if access_key or AWS_ACCESS_KEY_ID:
                    session_kwargs['aws_access_key_id'] = access_key or AWS_ACCESS_KEY_ID
                if secret_key or AWS_SECRET_ACCESS_KEY:
                    session_kwargs['aws_secret_access_key'] = secret_key or AWS_SECRET_ACCESS_KEY
                if session_token or AWS_SESSION_TOKEN:
                    session_kwargs['aws_session_token'] = session_token or AWS_SESSION_TOKEN
                
                if session_kwargs:
                    print("🔑 Using explicit AWS credentials")
                else:
                    print("🔑 Using default AWS credential chain")
            
            # Create session and client
            session = boto3.Session(**session_kwargs)
            self.s3_client = session.client('s3', region_name=region)
            self.region = region
            
            # Test credentials by making a simple call
            self.s3_client.list_buckets()
            print(f"✅ S3 client initialized successfully for region: {region}")
            
        except NoCredentialsError:
            print("❌ AWS credentials not found. Please set credentials in the script variables or configure AWS CLI.")
            print("💡 Update AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in the script")
            sys.exit(1)
        except ClientError as e:
            if e.response['Error']['Code'] == 'InvalidAccessKeyId':
                print("❌ Invalid AWS Access Key ID")
            elif e.response['Error']['Code'] == 'SignatureDoesNotMatch':
                print("❌ Invalid AWS Secret Access Key")
            else:
                print(f"❌ AWS credential error: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error initializing S3 client: {e}")
            sys.exit(1)

    def verify_bucket_exists(self, bucket_name):
        """Verify if bucket exists and is accessible"""
        try:
            self.s3_client.head_bucket(Bucket=bucket_name)
            print(f"✅ Bucket '{bucket_name}' is accessible")
            return True
        except ClientError as e:
            error_code = int(e.response['Error']['Code'])
            if error_code == 404:
                print(f"❌ Bucket '{bucket_name}' does not exist")
            elif error_code == 403:
                print(f"❌ Access denied to bucket '{bucket_name}'")
            else:
                print(f"❌ Error accessing bucket '{bucket_name}': {e}")
            return False

    def format_tags_for_upload(self, tags_dict):
        """Convert tags dictionary to URL-encoded string format for upload"""
        if not tags_dict:
            return ""
        
        tag_pairs = []
        for key, value in tags_dict.items():
            # URL encode key and value
            encoded_key = str(key).replace(' ', '+').replace('&', '%26').replace('=', '%3D')
            encoded_value = str(value).replace(' ', '+').replace('&', '%26').replace('=', '%3D')
            tag_pairs.append(f"{encoded_key}={encoded_value}")
        
        return "&".join(tag_pairs)

    def format_tags_for_put_tagging(self, tags_dict):
        """Convert tags dictionary to TagSet format for put_object_tagging"""
        if not tags_dict:
            return {'TagSet': []}
        
        tag_set = []
        for key, value in tags_dict.items():
            tag_set.append({'Key': str(key), 'Value': str(value)})
        
        return {'TagSet': tag_set}

    def upload_file_with_tags(self, file_path, bucket_name, object_key=None, tags=None, method='during_upload'):
        """
        Upload file to S3 with tags
        
        Args:
            file_path (str): Path to local file
            bucket_name (str): S3 bucket name
            object_key (str): S3 object key (optional, defaults to filename)
            tags (dict): Dictionary of tags to apply
            method (str): 'during_upload' or 'after_upload'
        """
        
        # Validate file exists
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            return False
        
        # Set default object key
        if not object_key:
            object_key = os.path.basename(file_path)
        
        # Verify bucket exists
        if not self.verify_bucket_exists(bucket_name):
            return False
        
        print(f"📤 Uploading '{file_path}' to 's3://{bucket_name}/{object_key}'")
        
        try:
            if method == 'during_upload':
                return self._upload_with_tags_during(file_path, bucket_name, object_key, tags)
            else:
                return self._upload_with_tags_after(file_path, bucket_name, object_key, tags)
                
        except Exception as e:
            print(f"❌ Upload failed: {e}")
            return False

    def _upload_with_tags_during(self, file_path, bucket_name, object_key, tags):
        """Upload file with tags applied during upload"""
        try:
            extra_args = {}
            if tags:
                tag_string = self.format_tags_for_upload(tags)
                extra_args['Tagging'] = tag_string
                print(f"🏷️  Tags to apply: {tags}")
            
            # Upload file
            with open(file_path, 'rb') as file_data:
                response = self.s3_client.put_object(
                    Bucket=bucket_name,
                    Key=object_key,
                    Body=file_data,
                    **extra_args
                )
            
            print(f"✅ Upload successful! ETag: {response.get('ETag', 'N/A')}")
            
            # Verify tags were applied
            if tags:
                return self._verify_tags(bucket_name, object_key, tags)
            
            return True
            
        except ClientError as e:
            print(f"❌ Upload error: {e}")
            return False

    def _upload_with_tags_after(self, file_path, bucket_name, object_key, tags):
        """Upload file first, then apply tags separately"""
        try:
            # First upload the file
            with open(file_path, 'rb') as file_data:
                response = self.s3_client.put_object(
                    Bucket=bucket_name,
                    Key=object_key,
                    Body=file_data
                )
            
            print(f"✅ File uploaded! ETag: {response.get('ETag', 'N/A')}")
            
            # Then apply tags if provided
            if tags:
                print(f"🏷️  Applying tags: {tags}")
                tag_set = self.format_tags_for_put_tagging(tags)
                
                self.s3_client.put_object_tagging(
                    Bucket=bucket_name,
                    Key=object_key,
                    Tagging=tag_set
                )
                
                print("✅ Tags applied successfully!")
                return self._verify_tags(bucket_name, object_key, tags)
            
            return True
            
        except ClientError as e:
            print(f"❌ Error: {e}")
            return False

    def _verify_tags(self, bucket_name, object_key, expected_tags):
        """Verify that tags were applied correctly"""
        try:
            response = self.s3_client.get_object_tagging(
                Bucket=bucket_name,
                Key=object_key
            )
            
            applied_tags = {}
            for tag in response['TagSet']:
                applied_tags[tag['Key']] = tag['Value']
            
            print(f"🔍 Tags verification:")
            print(f"   Expected: {expected_tags}")
            print(f"   Applied:  {applied_tags}")
            
            # Check if all expected tags are present
            missing_tags = []
            for key, value in expected_tags.items():
                if key not in applied_tags or applied_tags[key] != str(value):
                    missing_tags.append(f"{key}={value}")
            
            if missing_tags:
                print(f"⚠️  Missing or incorrect tags: {missing_tags}")
                return False
            else:
                print("✅ All tags verified successfully!")
                return True
                
        except ClientError as e:
            print(f"❌ Tag verification failed: {e}")
            return False

    def list_object_tags(self, bucket_name, object_key):
        """List tags for a specific object"""
        try:
            response = self.s3_client.get_object_tagging(
                Bucket=bucket_name,
                Key=object_key
            )
            
            if response['TagSet']:
                print(f"🏷️  Tags for 's3://{bucket_name}/{object_key}':")
                for tag in response['TagSet']:
                    print(f"   {tag['Key']} = {tag['Value']}")
            else:
                print(f"📝 No tags found for 's3://{bucket_name}/{object_key}'")
                
        except ClientError as e:
            print(f"❌ Error retrieving tags: {e}")


def parse_tags(tag_string):
    """Parse tags from command line string format"""
    if not tag_string:
        return {}
    
    tags = {}
    pairs = tag_string.split(',')
    
    for pair in pairs:
        if '=' in pair:
            key, value = pair.split('=', 1)
            tags[key.strip()] = value.strip()
        else:
            print(f"⚠️  Invalid tag format: '{pair}'. Use 'key=value' format.")
    
    return tags


def main():
    parser = argparse.ArgumentParser(
        description='Upload files to S3 with tags',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Upload with tags during upload
  python s3_upload.py file.txt my-bucket --tags "Environment=Production,Project=MyApp,Owner=John"
  
  # Upload with custom object key
  python s3_upload.py file.txt my-bucket --key "uploads/file.txt" --tags "Type=Document"
  
  # Upload with tags applied after upload
  python s3_upload.py file.txt my-bucket --tags "Stage=Test" --method after_upload
  
  # List tags for an existing object
  python s3_upload.py --list-tags my-bucket uploads/file.txt
        """
    )
    
    parser.add_argument('file_path', nargs='?', help='Path to file to upload')
    parser.add_argument('bucket_name', nargs='?', help='S3 bucket name')
    parser.add_argument('--key', help='S3 object key (default: filename)')
    parser.add_argument('--tags', help='Tags in format "key1=value1,key2=value2"')
    parser.add_argument('--method', choices=['during_upload', 'after_upload'], 
                       default='during_upload', help='When to apply tags')
    parser.add_argument('--region', default='us-east-1', help='AWS region')
    parser.add_argument('--list-tags', action='store_true', 
                       help='List tags for existing object (provide bucket and key)')
    
    args = parser.parse_args()
    
    # Initialize uploader
    uploader = S3Uploader(region_name=args.region)
    
    # Handle list tags operation
    if args.list_tags:
        if not args.bucket_name or not args.file_path:
            print("❌ For --list-tags, provide bucket_name and object_key")
            sys.exit(1)
        uploader.list_object_tags(args.bucket_name, args.file_path)
        return
    
    # Validate required arguments for upload
    if not args.file_path or not args.bucket_name:
        parser.print_help()
        sys.exit(1)
    
    # Parse tags
    tags = parse_tags(args.tags) if args.tags else {}
    
    # Upload file
    success = uploader.upload_file_with_tags(
        file_path=args.file_path,
        bucket_name=args.bucket_name,
        object_key=args.key,
        tags=tags,
        method=args.method
    )
    
    if success:
        print(f"🎉 Operation completed successfully!")
        sys.exit(0)
    else:
        print(f"💥 Operation failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()