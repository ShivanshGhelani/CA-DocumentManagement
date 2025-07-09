"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenBlacklistView
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from documents.tasks import add, process_document_upload, test_redis_integration, long_running_task

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_blacklist_token(request):
    """Test endpoint to blacklist the current user's refresh token"""
    try:
        # Get the refresh token from request data
        refresh_token = request.data.get('refresh_token')
        if not refresh_token:
            return JsonResponse({'error': 'refresh_token is required'}, status=400)
        
        # Blacklist the token
        token = RefreshToken(refresh_token)
        token.blacklist()
        
        return JsonResponse({
            'message': 'Token blacklisted successfully',
            'token_id': str(token.payload['jti'])
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@api_view(['GET'])
def test_redis_connection(request):
    """Test endpoint to check Redis connection"""
    try:
        import redis
        r = redis.Redis(host='redis', port=6379, db=1)
        r.set('test_key', 'hello_redis')
        value = r.get('test_key')
        r.delete('test_key')
        
        return JsonResponse({
            'message': 'Redis connection successful',
            'test_value': value.decode('utf-8') if value else None
        })
    except Exception as e:
        return JsonResponse({'error': f'Redis connection failed: {str(e)}'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_celery_task(request):
    """Test endpoint to trigger a Celery task"""
    try:
        x = request.data.get('x', 5)
        y = request.data.get('y', 3)
        
        # Trigger the Celery task
        task = add.delay(x, y)
        
        return JsonResponse({
            'message': 'Celery task triggered successfully',
            'task_id': task.id,
            'status': 'PENDING'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_redis_celery_integration(request):
    """Test endpoint to trigger a Celery task that uses Redis"""
    try:
        # Trigger the Redis integration task
        task = test_redis_integration.delay()
        
        return JsonResponse({
            'message': 'Redis-Celery integration task triggered',
            'task_id': task.id,
            'status': 'PENDING'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_long_running_task(request):
    """Test endpoint to trigger a long-running Celery task"""
    try:
        task_name = request.data.get('task_name', 'test_task')
        
        # Trigger the long-running task
        task = long_running_task.delay(task_name)
        
        return JsonResponse({
            'message': 'Long-running task triggered',
            'task_id': task.id,
            'status': 'PENDING',
            'task_name': task_name
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['GET'])
def get_task_result(request, task_id):
    """Get the result of a Celery task"""
    try:
        from celery.result import AsyncResult
        
        result = AsyncResult(task_id)
        
        if result.ready():
            return JsonResponse({
                'task_id': task_id,
                'status': result.status,
                'result': result.result
            })
        else:
            return JsonResponse({
                'task_id': task_id,
                'status': result.status,
                'result': None
            })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

urlpatterns = [
    path("", include("admin_index.urls")),  # Root path for admin index
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("documents.urls")),
    path("api/audit/", include("audit.urls")),
    path("api/token/blacklist/", TokenBlacklistView.as_view(), name='token_blacklist'),
    path("api/test/blacklist/", test_blacklist_token, name='test_blacklist'),
    path("api/test/redis/", test_redis_connection, name='test_redis'),
    path("api/test/celery/", test_celery_task, name='test_celery'),
    path("api/test/celery-redis/", test_redis_celery_integration, name='test_celery_redis'),
    path("api/test/long-task/", test_long_running_task, name='test_long_task'),
    path("api/test/task-result/<str:task_id>/", get_task_result, name='get_task_result'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
