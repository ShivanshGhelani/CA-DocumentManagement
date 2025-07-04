from celery import shared_task
import time
import redis
from django.conf import settings

@shared_task
def add(x, y):
    """Simple addition task"""
    print(f"Adding {x} + {y}")
    time.sleep(2)  # Simulate some work
    return x + y

@shared_task
def process_document_upload(document_id):
    """Simulate document processing task"""
    print(f"Processing document {document_id}")
    time.sleep(5)  # Simulate processing time
    return f"Document {document_id} processed successfully"

@shared_task
def send_email_notification(user_id, message):
    """Simulate email sending task"""
    print(f"Sending email to user {user_id}: {message}")
    time.sleep(3)  # Simulate email sending time
    return f"Email sent to user {user_id}"

@shared_task
def test_redis_integration():
    """Test task that uses Redis"""
    try:
        # Connect to Redis
        r = redis.Redis(host='redis', port=6379, db=1)
        
        # Set a value
        r.set('celery_test_key', 'hello_from_celery')
        
        # Get the value
        value = r.get('celery_test_key')
        
        # Clean up
        r.delete('celery_test_key')
        
        return {
            'status': 'success',
            'message': 'Redis integration working in Celery',
            'value': value.decode('utf-8') if value else None
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Redis integration failed: {str(e)}'
        }

@shared_task
def long_running_task(task_name):
    """Simulate a long-running task"""
    print(f"Starting long task: {task_name}")
    
    for i in range(10):
        print(f"Task {task_name}: Step {i+1}/10")
        time.sleep(1)
    
    print(f"Completed long task: {task_name}")
    return f"Task {task_name} completed successfully" 