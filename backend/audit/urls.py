from django.urls import path
from . import views

urlpatterns = [
    path('logs/', views.AuditLogListView.as_view(), name='audit-log-list'),
    path('logs/<uuid:pk>/', views.AuditLogDetailView.as_view(), name='audit-log-detail'),
]
