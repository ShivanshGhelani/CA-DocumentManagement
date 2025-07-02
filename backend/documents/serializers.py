from rest_framework import serializers
from .models import Document, DocumentVersion, Tag, DocumentAccess
from accounts.serializers import UserProfileSerializer


class TagSerializer(serializers.ModelSerializer):
    """Serializer for Tag model with key-value support"""
    documents_count = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    created_by = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = Tag
        fields = ('id', 'key', 'value', 'display_name', 'color', 'documents_count', 'created_at', 'created_by')
        read_only_fields = ('id', 'created_at', 'created_by')
    
    def get_documents_count(self, obj):
        return obj.documents.count()
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def validate(self, data):
        """Validate that key is provided"""
        if not data.get('key'):
            raise serializers.ValidationError({'key': 'Key is required for tags.'})
        return data


class DocumentVersionSerializer(serializers.ModelSerializer):
    """Serializer for DocumentVersion model"""
    created_by = UserProfileSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = DocumentVersion
        fields = ('id', 'version_number', 'file', 'file_url', 'file_size', 
                 'changes_description', 'created_by', 'created_at')
        read_only_fields = ('id', 'file_size', 'created_by', 'created_at')
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class DocumentAccessSerializer(serializers.ModelSerializer):
    """Serializer for DocumentAccess model"""
    user = UserProfileSerializer(read_only=True)
    granted_by = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = DocumentAccess
        fields = ('id', 'user', 'permission', 'granted_by', 'granted_at')
        read_only_fields = ('id', 'granted_by', 'granted_at')


class DocumentListSerializer(serializers.ModelSerializer):
    """Serializer for Document list view"""
    created_by = UserProfileSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    
    class Meta:
        model = Document
        fields = ('id', 'title', 'description', 'content', 'file_url', 'file_size', 
                 'file_type', 'status', 'version', 'created_by', 'tags', 
                 'created_at', 'updated_at', 'can_edit')
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        # Owner can always edit
        if obj.created_by == request.user:
            return True
        
        # Check document access permissions
        access = obj.access_permissions.filter(
            user=request.user,
            permission__in=['write', 'admin']
        ).first()
        return bool(access)


class DocumentDetailSerializer(serializers.ModelSerializer):
    """Serializer for Document detail view"""
    created_by = UserProfileSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    versions = DocumentVersionSerializer(many=True, read_only=True)
    access_permissions = DocumentAccessSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    
    class Meta:
        model = Document
        fields = ('id', 'title', 'description', 'content', 'file', 'file_url', 'file_size', 
                 'file_type', 'status', 'version', 'created_by', 'tags', 'tag_ids',
                 'versions', 'access_permissions', 'created_at', 'updated_at',
                 'can_edit', 'can_delete')
        read_only_fields = ('id', 'file_size', 'file_type', 'version', 'created_by',
                           'created_at', 'updated_at')
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        if obj.created_by == request.user:
            return True
        
        access = obj.access_permissions.filter(
            user=request.user,
            permission__in=['write', 'admin']
        ).first()
        return bool(access)
    
    def get_can_delete(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        if obj.created_by == request.user:
            return True
        
        access = obj.access_permissions.filter(
            user=request.user,
            permission='admin'
        ).first()
        return bool(access)
    
    def create(self, validated_data):
        tag_ids = validated_data.pop('tag_ids', [])
        validated_data['created_by'] = self.context['request'].user
        document = super().create(validated_data)
        
        if tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids)
            document.tags.set(tags)
        
        return document
    def get_can_view(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return (
            obj.created_by == request.user or
            obj.status == 'published' or
            obj.access_permissions.filter(user=request.user).exists()
        )

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop('tag_ids', None)
        
        # If file is being updated, create a new version
        if 'file' in validated_data and validated_data['file']:
            old_file = instance.file
            DocumentVersion.objects.create(
                document=instance,
                version_number=instance.version,
                file=old_file,
                file_size=instance.file_size,
                changes_description=f"Version {instance.version} backup",
                created_by=instance.created_by
            )
            instance.version += 1
        
        instance = super().update(instance, validated_data)
        
        if tag_ids is not None:
            tags = Tag.objects.filter(id__in=tag_ids)
            instance.tags.set(tags)
        
        return instance


class DocumentCreateSerializer(serializers.ModelSerializer):
    """Serializer for Document creation with content and file support"""
    
    tags_data = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="List of tag objects with 'key' and optional 'value' fields"
    )
    
    class Meta:
        model = Document
        fields = ('id', 'title', 'description', 'content', 'file', 'status', 'tags_data')
        read_only_fields = ('id',)
    
    def validate(self, data):
        """Validate that either content or file is provided"""
        content = data.get('content', '').strip()
        file = data.get('file')
        
        if not content and not file:
            raise serializers.ValidationError("Either content or file must be provided.")
        
        return data
    
    def validate_file(self, value):
        """File validation for size and type"""
        if not value:
            return value
            
        # File size validation (10MB max)
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('File size cannot exceed 10MB')
        
        # File type validation
        allowed_extensions = ['pdf', 'docx', 'txt']
        file_extension = value.name.split('.')[-1].lower()
        if file_extension not in allowed_extensions:
            raise serializers.ValidationError(
                f'File type not supported. Allowed types: {", ".join(allowed_extensions)}'
            )
        
        return value
    
    def validate_tags_data(self, value):
        """Validate tags data structure"""
        if not value:
            return value
        
        # Handle JSON string input (from multipart form data)
        if isinstance(value, str):
            try:
                import json
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Invalid JSON format for tags_data")
        
        if not isinstance(value, list):
            raise serializers.ValidationError("tags_data must be a list of tag objects")
            
        for i, tag_data in enumerate(value):
            if not isinstance(tag_data, dict):
                raise serializers.ValidationError(f"Tag at index {i} must be an object with 'key' and optional 'value'")
            
            if 'key' not in tag_data or not tag_data['key'] or not tag_data['key'].strip():
                raise serializers.ValidationError(f"Tag at index {i} must have a non-empty 'key' field")
                
            # Limit key and value lengths
            if len(tag_data['key']) > 50:
                raise serializers.ValidationError(f"Tag key at index {i} cannot exceed 50 characters")
                
            if 'value' in tag_data and tag_data['value'] and len(str(tag_data['value'])) > 100:
                raise serializers.ValidationError(f"Tag value at index {i} cannot exceed 100 characters")
        
        return value
    
    def create(self, validated_data):
        tags_data = validated_data.pop('tags_data', [])
        validated_data['created_by'] = self.context['request'].user
        
        # Create the document
        document = super().create(validated_data)
        
        # Create and associate tags
        if tags_data:
            for tag_data in tags_data:
                key = tag_data['key'].strip()
                value = tag_data.get('value', '').strip() if tag_data.get('value') else ''
                
                # Get or create the tag for this user
                tag, created = Tag.objects.get_or_create(
                    key=key,
                    value=value,
                    created_by=self.context['request'].user,
                    defaults={'color': '#007bff'}
                )
                document.tags.add(tag)
        
        return document


class DocumentRollbackSerializer(serializers.Serializer):
    version_id = serializers.UUIDField()
    reason = serializers.CharField(required=False, allow_blank=True)