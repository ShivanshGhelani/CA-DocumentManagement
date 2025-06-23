from decouple import config
import boto3
from botocore.exceptions import NoCredentialsError, ClientError

AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY")
AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME")
AWS_S3_REGION_NAME = config("AWS_S3_REGION_NAME", default="us-east-1")

TEST_FILE_PATH = "sample.txt"
S3_KEY = "test/sample.txt"

def main():
    print("📡 Connecting to AWS S3...")

    try:
        s3 = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_S3_REGION_NAME,
        )

        with open(TEST_FILE_PATH, "rb") as file_data:
            s3.upload_fileobj(file_data, AWS_STORAGE_BUCKET_NAME, S3_KEY)
        
        print("✅ File uploaded successfully.")
        s3_url = f"https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/{S3_KEY}"
        print(f"🌐 File URL: {s3_url}")

    except NoCredentialsError:
        print("❌ AWS credentials not found. Check your .env and Docker environment.")
    except ClientError as e:
        print(f"❌ AWS ClientError: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
