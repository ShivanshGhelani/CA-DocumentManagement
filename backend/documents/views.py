from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.http import Http404
from .models import Document, DocumentVersion, Tag, DocumentAccess
from .serializers import (
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentCreateSerializer,
    TagSerializer,
    DocumentVersionSerializer,
    DocumentAccessSerializer,
)
from .filters import DocumentFilter
from audit.models import AuditLog
import json
import boto3
from django.conf import settings


class TagListCreateView(generics.ListCreateAPIView):
    """List and create tags"""

    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only return tags that are either:
        # 1. Associated with non-deleted documents, OR
        # 2. Not associated with any documents yet (for new tag creation)
        # Return all tags created by the user, associated with non-deleted documents or not associated yet
        return Tag.objects.all()

    def perform_create(self, serializer):
        tag = serializer.save()

        # Log tag creation
        AuditLog.log_activity(
            user=self.request.user,
            action="create",
            resource_type="tag",
            resource_id=tag.id,
            resource_name=tag.name,
            content_object=tag,
            request=self.request,
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
            action="update",
            resource_type="tag",
            resource_id=tag.id,
            resource_name=tag.name,
            content_object=tag,
            request=self.request,
        )

    def perform_destroy(self, instance):
        # Log tag deletion
        AuditLog.log_activity(
            user=self.request.user,
            action="delete",
            resource_type="tag",
            resource_id=instance.id,
            resource_name=instance.name,
            request=self.request,
        )

        instance.delete()


class DocumentListView(generics.ListAPIView):
    """List documents with filtering and search"""

    serializer_class = DocumentListSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = DocumentFilter
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        user = self.request.user

        queryset = Document.objects.all()

        # Published docs visible to everyone
        published_qs = Q(status="published")

        # Drafts & archived only visible to the owner
        owned_qs = Q(created_by=user) & ~Q(status="published")

        # Docs explicitly shared with the user
        shared_qs = Q(access_permissions__user=user)

        queryset = queryset.filter(published_qs | owned_qs | shared_qs).distinct()

        # Tag filtering
        tag_ids = self.request.query_params.getlist(
            "tags[]"
        ) or self.request.query_params.getlist("tags")
        if tag_ids:
            queryset = queryset.filter(tags__id__in=tag_ids).distinct()

        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        # Log document list access
        AuditLog.log_activity(
            user=request.user,
            action="read",
            resource_type="document",
            resource_id="list",
            resource_name="Document List",
            details={"filters": dict(request.query_params)},
            request=request,
        )

        return response


class DocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, and delete documents"""

    serializer_class = DocumentDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


    def get_queryset(self):
        user = self.request.user

        # Match list view's visibility logic
        published_qs = Q(status="published")
        owned_qs = Q(created_by=user) & ~Q(status="published")
        shared_qs = Q(access_permissions__user=user)

        return Document.objects.filter(published_qs | owned_qs | shared_qs).distinct()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Log document access
        AuditLog.log_activity(
            user=request.user,
            action="read",
            resource_type="document",
            resource_id=str(instance.id),
            resource_name=instance.title,
            content_object=instance,
            request=request,
        )
        return super().retrieve(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if instance.created_by != user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You do not have permission to edit this document.")
        document = serializer.save()
        AuditLog.log_activity(
            user=user,
            action="update",
            resource_type="document",
            resource_id=str(document.id),
            resource_name=document.title,
            content_object=document,
            request=self.request,
        )

    def perform_destroy(self, instance):
        user = self.request.user
        if instance.created_by != user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have permission to delete this document."
            )
        instance.soft_delete(user)
        AuditLog.log_activity(
            user=user,
            action="soft_delete",
            resource_type="document",
            resource_id=str(instance.id),
            resource_name=instance.title,
            request=self.request,
        )


class DocumentCreateView(generics.CreateAPIView):
    serializer_class = DocumentCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        document = serializer.save()  # Uploads file to S3 via django-storages

        tags_data = self.request.data.get("tags_data")
        if isinstance(tags_data, str):
            tags_data = json.loads(tags_data)

        if document.file and tags_data:
            # Prepare TagSet for S3
            tag_set = [
                {"Key": tag["key"], "Value": tag.get("value", "")} for tag in tags_data
            ]

            # S3 client
            s3_client = boto3.client(
                "s3",
                region_name=settings.AWS_S3_REGION_NAME,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )

            # document.file.name is the S3 key path (e.g. "uploads/my-file.pdf")
            s3_client.put_object_tagging(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=document.file.name,
                Tagging={"TagSet": tag_set},
            )

        # Audit log
        AuditLog.log_activity(
            user=self.request.user,
            action="create",
            resource_type="document",
            resource_id=str(document.id),
            resource_name=document.title,
            content_object=document,
            request=self.request,
        )


@api_view(["POST"])
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
                    {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
                )

        # Log download
        AuditLog.log_activity(
            user=user,
            action="download",
            resource_type="document",
            resource_id=str(document.id),
            resource_name=document.title,
            content_object=document,
            request=request,
        )

        return Response(
            {
                "download_url": request.build_absolute_uri(document.file.url),
                "filename": document.file.name.split("/")[-1],
                "file_size": document.file_size,
            }
        )

    except Document.DoesNotExist:
        return Response(
            {"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND
        )


class DocumentVersionListView(generics.ListAPIView):
    """List document versions"""

    serializer_class = DocumentVersionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        document_id = self.kwargs["document_id"]

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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def document_share(request, pk):
    """Share document with another user"""
    try:
        document = Document.objects.get(pk=pk)
        user = request.user

        # Check if user can share (owner or admin)
        if document.created_by != user:
            access = document.access_permissions.filter(
                user=user, permission="admin"
            ).first()
            if not access:
                return Response(
                    {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
                )

        email = request.data.get("email")
        permission = request.data.get("permission", "read")

        if not email:
            return Response(
                {"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            target_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Create or update access permission
        access, created = DocumentAccess.objects.get_or_create(
            document=document,
            user=target_user,
            defaults={"permission": permission, "granted_by": user},
        )

        if not created:
            access.permission = permission
            access.granted_by = user
            access.save()

        # Log document sharing
        AuditLog.log_activity(
            user=user,
            action="share",
            resource_type="document",
            resource_id=str(document.id),
            resource_name=document.title,
            details={"shared_with": email, "permission": permission},
            content_object=document,
            request=request,
        )

        return Response(
            {
                "message": f"Document shared with {email}",
                "access": DocumentAccessSerializer(access).data,
            }
        )

    except Document.DoesNotExist:
        return Response(
            {"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND
        )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def restore_document(request, pk):
    """Restore a soft-deleted document"""
    try:
        # Get document from all documents including deleted ones
        document = Document.objects.all_with_deleted().get(pk=pk, is_deleted=True)

        # Check restore permissions (only owner or admin can restore)
        user = request.user
        if document.created_by != user:
            access = document.access_permissions.filter(
                user=user, permission="admin"
            ).first()
            if not access:
                return Response(
                    {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
                )

        # Restore the document
        document.restore()

        # Log restore action
        AuditLog.log_activity(
            user=user,
            action="restore",
            resource_type="document",
            resource_id=str(document.id),
            resource_name=document.title,
            content_object=document,
            request=request,
        )

        return Response({"message": "Document restored successfully"})

    except Document.DoesNotExist:
        return Response(
            {"error": "Document not found or not deleted"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def deleted_documents(request):
    """List soft-deleted documents for the current user"""
    from django.utils import timezone
    from datetime import timedelta

    user = request.user
    deleted_docs = Document.objects.deleted_only().filter(created_by=user)

    # Grace period in days (configurable)
    GRACE_PERIOD_DAYS = 30

    documents_data = []
    for doc in deleted_docs:
        # Calculate days remaining before permanent deletion
        days_since_deletion = (timezone.now() - doc.deleted_at).days
        days_remaining = max(0, GRACE_PERIOD_DAYS - days_since_deletion)

        documents_data.append(
            {
                "id": str(doc.id),
                "title": doc.title,
                "description": doc.description,
                "deleted_at": doc.deleted_at,
                "deleted_by": doc.deleted_by.email if doc.deleted_by else None,
                "days_remaining": days_remaining,
                "expires_soon": days_remaining <= 7,  # Warn when 7 days or less
            }
        )

    return Response(documents_data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def tag_suggestions(request):
    """Get tag suggestions for auto-complete"""
    query = request.query_params.get("q", "").strip()
    user = request.user
    # Get unique keys for the user (only from non-deleted documents)
    keys_queryset = (
        Tag.objects.filter(created_by=user)
        .filter(Q(documents__isnull=True) | Q(documents__is_deleted=False))
        .distinct()
    )

    if query:
        # Filter by key or value containing the query
        keys_queryset = keys_queryset.filter(
            Q(key__icontains=query) | Q(value__icontains=query)
        )

    # Get unique keys
    unique_keys = set(keys_queryset.values_list("key", flat=True))
    # For each key, get all unique values (only from non-deleted documents)
    suggestions = []
    for key in unique_keys:
        values = (
            Tag.objects.filter(created_by=user, key=key)
            .filter(Q(documents__isnull=True) | Q(documents__is_deleted=False))
            .values_list("value", flat=True)
            .distinct()
        )

        # Add the key without value
        suggestions.append({"key": key, "value": ""})

        # Add key-value combinations
        for value in values:
            if value:  # Only add non-empty values
                suggestions.append({"key": key, "value": value})

    # Sort suggestions
    suggestions.sort(key=lambda x: (x["key"], x["value"]))

    return Response(suggestions[:20])  # Limit to 20 suggestions


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def permanent_delete_document(request, pk):
    """Permanently delete a document, its file from S3, and its tags if unused."""
    try:
        user = request.user
        document = Document.objects.all_with_deleted().get(pk=pk)
        if document.created_by != user:
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        # Delete file from S3 if exists
        if document.file:
            s3_client = boto3.client(
                "s3",
                region_name=settings.AWS_S3_REGION_NAME,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
            try:
                s3_client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=document.file.name)
            except Exception as e:
                # Log but don't block deletion if file is missing
                print(f"S3 file delete error: {e}")

        # Collect tags to check for orphaned tags
        tag_ids = list(document.tags.values_list('id', flat=True))

        # Delete the document (this will also remove M2M relations)
        document.delete()

        # Delete tags that are not used by any other documents
        for tag_id in tag_ids:
            tag = Tag.objects.filter(id=tag_id).first()
            if tag and tag.documents.count() == 0:
                tag.delete()

        # Log audit
        AuditLog.log_activity(
            user=user,
            action="permanent_delete",
            resource_type="document",
            resource_id=str(pk),
            resource_name=getattr(document, 'title', str(pk)),
            request=request,
        )
        return Response({"message": "Document permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
    except Document.DoesNotExist:
        return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
