from rest_framework import generics, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import AuditLog
from .serializers import AuditLogSerializer, AuditLogListSerializer


class AuditLogListView(generics.ListAPIView):
    """List audit logs with filtering"""
    serializer_class = AuditLogListSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'resource_type', 'user']
    search_fields = ['resource_name', 'user__email']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']
    
    def get_queryset(self):
        user = self.request.user
        
        # Users can only see their own audit logs unless they're staff
        if user.is_staff:
            return AuditLog.objects.all()
        else:
            return AuditLog.objects.filter(user=user)


class AuditLogDetailView(generics.RetrieveAPIView):
    """Retrieve detailed audit log"""
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Users can only see their own audit logs unless they're staff
        if user.is_staff:
            return AuditLog.objects.all()
        else:
            return AuditLog.objects.filter(user=user)
