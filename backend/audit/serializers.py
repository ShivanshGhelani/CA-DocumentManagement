from rest_framework import serializers
from .models import AuditLog
from accounts.serializers import UserProfileSerializer


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model"""
    user = UserProfileSerializer(read_only=True)
    timestamp_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'action', 'resource_type', 'resource_id', 
                 'resource_name', 'details', 'ip_address', 'user_agent', 
                 'timestamp', 'timestamp_formatted')
        read_only_fields = ('id', 'timestamp')
    
    def get_timestamp_formatted(self, obj):
        return obj.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')


class AuditLogListSerializer(serializers.ModelSerializer):
    """Simplified serializer for AuditLog list view"""
    user_email = serializers.CharField(source='user.email', read_only=True)
    timestamp_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditLog
        fields = ('id', 'user_email', 'action', 'resource_type', 'resource_name', 
                 'ip_address', 'timestamp', 'timestamp_formatted')
    
    def get_timestamp_formatted(self, obj):
        return obj.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
