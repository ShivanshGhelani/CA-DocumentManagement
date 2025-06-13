from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.http import Http404
from .models import Document, DocumentVersion, Tag, DocumentAccess
from .serializers import (
    DocumentListSerializer, DocumentDetailSerializer, DocumentCreateSerializer,
    TagSerializer, DocumentVersionSerializer, DocumentAccessSerializer
)
from audit.models import AuditLog


class TagListCreateView(generics.ListCreateAPIView):
    """List and create tags"""
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Tag.objects.filter(created_by=self.request.user)
    
    def perform_create(self, serializer):
        tag = serializer.save()
        
        # Log tag creation
        AuditLog.log_activity(
            user=self.request.user,
            action='create',
            resource_type='tag',
            resource_id=tag.id,
            resource_name=tag.name,
            content_object=tag,
            request=self.request
        )


class TagDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, and delete tags"""
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Tag.objects.filter(created_by=self.request.user)
    
    def perform_update(self, serializer):
        tag = serializer.save()
        
        # Log tag update
        AuditLog.log_activity(
            user=self.request.user,
            action='update',
            resource_type='tag',
            resource_id=tag.id,
            resource_name=tag.name,
            content_object=tag,
            request=self.request
        )
    
    def perform_destroy(self, instance):
        # Log tag deletion
        AuditLog.log_activity(
            user=self.request.user,
            action='delete',
            resource_type='tag',
            resource_id=instance.id,
            resource_name=instance.name,
            request=self.request
        )
        
        instance.delete()


class DocumentListView(generics.ListAPIView):
    """List documents with filtering and search"""
    serializer_class = DocumentListSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'file_type', 'tags']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'title']
    ordering = ['-updated_at']
    
    def get_queryset(self):
        user = self.request.user
        
        # Get documents created by user or shared with user using Q objects
        queryset = Document.objects.filter(
            Q(created_by=user) | Q(access_permissions__user=user)
        ).distinct()
        
        # Additional filtering
        tag_names = self.request.query_params.getlist('tag_name')
        if tag_names:
            queryset = queryset.filter(tags__name__in=tag_names).distinct()
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        
        # Log document list access
        AuditLog.log_activity(
            user=request.user,
            action='read',
            resource_type='document',
            resource_id='list',
            resource_name='Document List',
            details={'filters': dict(request.query_params)},
            request=request
        )
        
        return response


class DocumentCreateView(generics.CreateAPIView):
    """Create new document"""
    serializer_class = DocumentCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        document = serializer.save()
        
        # Log document creation
        AuditLog.log_activity(
            user=self.request.user,
            action='create',
            resource_type='document',
            resource_id=str(document.id),
            resource_name=document.title,
            content_object=document,
            request=self.request
        )


class DocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, and delete documents"""
    serializer_class = DocumentDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Get documents created by user or shared with user
        owned_docs = Document.objects.filter(created_by=user)
        shared_docs = Document.objects.filter(
            access_permissions__user=user
        ).distinct()
        
        return (owned_docs | shared_docs).distinct()
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Log document access
        AuditLog.log_activity(
            user=request.user,
            action='read',
            resource_type='document',
            resource_id=str(instance.id),
            resource_name=instance.title,
            content_object=instance,
            request=request
        )
        
        return super().retrieve(request, *args, **kwargs)
    
    def perform_update(self, serializer):
        instance = self.get_object()
        
        # Check edit permissions
        if not self._can_edit(instance):
            raise Http404("You don't have permission to edit this document")
        
        document = serializer.save()
        
        # Log document update
        AuditLog.log_activity(
            user=self.request.user,
            action='update',
            resource_type='document',
            resource_id=str(document.id),
            resource_name=document.title,
            content_object=document,
            request=self.request
        )
    
    def perform_destroy(self, instance):
        # Check delete permissions
        if not self._can_delete(instance):
            raise Http404("You don't have permission to delete this document")
        
        # Log document deletion
        AuditLog.log_activity(
            user=self.request.user,
            action='delete',
            resource_type='document',
            resource_id=str(instance.id),
            resource_name=instance.title,
            request=self.request
        )
        
        instance.delete()
    
    def _can_edit(self, document):
        user = self.request.user
        if document.created_by == user:
            return True
        
        access = document.access_permissions.filter(
            user=user,
            permission__in=['write', 'admin']
        ).first()
        return bool(access)
    
    def _can_delete(self, document):
        user = self.request.user
        if document.created_by == user:
            return True
        
        access = document.access_permissions.filter(
            user=user,
            permission='admin'
        ).first()
        return bool(access)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_download(request, pk):
    """Download document file"""
    try:
        user = request.user
        document = Document.objects.get(pk=pk)
        
        # Check access permissions
        if document.created_by != user:
            access = document.access_permissions.filter(user=user).first()
            if not access:
                return Response(
                    {'error': 'Permission denied'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Log download
        AuditLog.log_activity(
            user=user,
            action='download',
            resource_type='document',
            resource_id=str(document.id),
            resource_name=document.title,
            content_object=document,
            request=request
        )
        
        return Response({
            'download_url': request.build_absolute_uri(document.file.url),
            'filename': document.file.name.split('/')[-1],
            'file_size': document.file_size
        })
        
    except Document.DoesNotExist:
        return Response(
            {'error': 'Document not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


class DocumentVersionListView(generics.ListAPIView):
    """List document versions"""
    serializer_class = DocumentVersionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        document_id = self.kwargs['document_id']
        
        # Verify user has access to the document
        try:
            document = Document.objects.get(pk=document_id)
            user = self.request.user
            
            if document.created_by != user:
                access = document.access_permissions.filter(user=user).first()
                if not access:
                    return DocumentVersion.objects.none()
            
            return DocumentVersion.objects.filter(document=document)
            
        except Document.DoesNotExist:
            return DocumentVersion.objects.none()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_share(request, pk):
    """Share document with another user"""
    try:
        document = Document.objects.get(pk=pk)
        user = request.user
        
        # Check if user can share (owner or admin)
        if document.created_by != user:
            access = document.access_permissions.filter(
                user=user,
                permission='admin'
            ).first()
            if not access:
                return Response(
                    {'error': 'Permission denied'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        email = request.data.get('email')
        permission = request.data.get('permission', 'read')
        
        if not email:
            return Response(
                {'error': 'Email is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            target_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create or update access permission
        access, created = DocumentAccess.objects.get_or_create(
            document=document,
            user=target_user,
            defaults={
                'permission': permission,
                'granted_by': user
            }
        )
        
        if not created:
            access.permission = permission
            access.granted_by = user
            access.save()
        
        # Log document sharing
        AuditLog.log_activity(
            user=user,
            action='share',
            resource_type='document',
            resource_id=str(document.id),
            resource_name=document.title,
            details={
                'shared_with': email,
                'permission': permission
            },
            content_object=document,
            request=request
        )
        
        return Response({
            'message': f'Document shared with {email}',
            'access': DocumentAccessSerializer(access).data
        })
        
    except Document.DoesNotExist:
        return Response(
            {'error': 'Document not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
