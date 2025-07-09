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
    reason = serializers.CharField(read_only=True)
    
    class Meta:
        model = DocumentVersion
        fields = ('id', 'version_number', 'file', 'file_url', 'file_size', 
                 'changes_description', 'reason', 'created_by', 'created_at')
        read_only_fields = ('id', 'file_size', 'created_by', 'created_at', 'reason')
    
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
    file_size = serializers.SerializerMethodField()
    file_type = serializers.SerializerMethodField()
    version_number = serializers.SerializerMethodField()
    
    class Meta:
        model = Document
        fields = ('id', 'short_id', 'title', 'description', 'file_url', 'file_size', 
                 'file_type', 'status', 'version_number', 'created_by', 'tags', 
                 'created_at', 'updated_at', 'can_edit')
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_file_size(self, obj):
        return obj.file_size
    
    def get_file_type(self, obj):
        return obj.file_type
    
    def get_version_number(self, obj):
        return obj.version_number
    
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
    file_size = serializers.SerializerMethodField()
    file_type = serializers.SerializerMethodField()
    version_number = serializers.SerializerMethodField()
    
    class Meta:
        model = Document
        fields = ('id', 'short_id', 'title', 'description', 'file_url', 'file_size', 
                 'file_type', 'status', 'version_number', 'created_by', 'tags', 'tag_ids',
                 'versions', 'access_permissions', 'created_at', 'updated_at',
                 'can_edit', 'can_delete', 'current_version')
        read_only_fields = ('id', 'short_id', 'file_size', 'file_type', 'version_number', 'created_by',
                           'created_at', 'updated_at', 'current_version')
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_file_size(self, obj):
        return obj.file_size
    
    def get_file_type(self, obj):
        return obj.file_type
    
    def get_version_number(self, obj):
        return obj.version_number
    
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
        
        # Update only basic metadata fields (not file-related)
        instance = super().update(instance, validated_data)
        
        if tag_ids is not None:
            tags = Tag.objects.filter(id__in=tag_ids)
            instance.tags.set(tags)
        
        return instance


class DocumentCreateSerializer(serializers.ModelSerializer):
    """Serializer for Document creation with versioning support"""
    
    tags_data = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="List of tag objects with 'key' and optional 'value' fields"
    )
    file = serializers.FileField(required=True)
    
    class Meta:
        model = Document
        fields = ('id', 'title', 'description', 'file', 'status', 'tags_data')
        read_only_fields = ('id',)
    
    def validate_file(self, value):
        """File validation for size and type"""
        if not value:
            raise serializers.ValidationError("File is required for document creation.")
            
        # File size validation (10MB max)
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('File size cannot exceed 10MB')
        
        # File type validation
        allowed_extensions = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg']
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
        file = validated_data.pop('file')
        user = self.context['request'].user
        
        # Create the document without a file
        validated_data['created_by'] = user
        document = Document.objects.create(**validated_data)
        
        # Create the first version with the file
        first_version = DocumentVersion.objects.create(
            document=document,
            version_number=1,
            title=document.title,
            description=document.description,
            file=file,
            created_by=user,
            changes_description="Initial version"
        )
        
        # Set the current version
        document.current_version = first_version
        document.save()
        
        # Create and associate tags
        if tags_data:
            for tag_data in tags_data:
                key = tag_data['key'].strip()
                value = tag_data.get('value', '').strip() if tag_data.get('value') else ''
                
                # Get or create the tag for this user
                tag, created = Tag.objects.get_or_create(
                    key=key,
                    value=value,
                    created_by=user,
                    defaults={'color': '#007bff'}
                )
                document.tags.add(tag)
                first_version.tags.add(tag)
        
        return document


class DocumentVersionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new document versions"""
    inherit_metadata = serializers.BooleanField(default=True, write_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = DocumentVersion
        fields = ('id', 'title', 'description', 'file', 'changes_description', 
                 'reason', 'inherit_metadata', 'tags', 'tag_ids')
        read_only_fields = ('id',)
    
    def validate(self, data):
        """Custom validation to handle optional fields when inheriting metadata"""
        inherit_metadata = data.get('inherit_metadata', True)
        
        # If not inheriting metadata, title is required
        if not inherit_metadata and not data.get('title'):
            raise serializers.ValidationError({'title': 'Title is required when not inheriting metadata.'})
                
        return data
    
    def create(self, validated_data):
        document = self.context['document']
        user = self.context['request'].user
        inherit_metadata = validated_data.pop('inherit_metadata', True)
        tag_ids = validated_data.pop('tag_ids', None)
        file = validated_data.pop('file')
        
        # Create new version using the document's method
        result = document.create_new_version(
            file=file,
            user=user,
            inherit_metadata=inherit_metadata,
            **validated_data
        )
        
        # Handle the tuple response from create_new_version
        if isinstance(result, tuple):
            new_version, message = result
        else:
            new_version = result
        
        # Handle tags if provided and not inheriting metadata
        if not inherit_metadata and tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids, created_by=user)
            new_version.tags.set(tags)
        
        return new_version


class DocumentRollbackSerializer(serializers.Serializer):
    """Serializer for document rollback operations"""
    version_id = serializers.UUIDField(required=True)
    
    def validate_version_id(self, value):
        document = self.context['document']
        try:
            version = document.versions.get(id=value)
            return value
        except DocumentVersion.DoesNotExist:
            raise serializers.ValidationError("Version not found for this document.")
    
    def save(self):
        document = self.context['document']
        user = self.context['request'].user
        version_id = self.validated_data['version_id']
        
        result = document.rollback_to_version(version_id, user)
        # Handle the tuple response from rollback_to_version
        if isinstance(result, tuple):
            success, message = result
            if not success:
                raise serializers.ValidationError(message)
        else:
            # Fallback if method returns just boolean
            if not result:
                raise serializers.ValidationError("Failed to rollback to the specified version.")
        
        return document


class DocumentVersionHistorySerializer(serializers.ModelSerializer):
    """Serializer for document version history"""
    created_by = UserProfileSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    
    class Meta:
        model = DocumentVersion
        fields = ('id', 'version_number', 'title', 'description', 'file_url', 
                 'download_url', 'file_size', 'file_type', 'changes_description', 
                 'reason', 'tags', 'created_by', 'created_at', 'is_current')
        read_only_fields = ('id', 'version_number', 'title', 'description', 'file_url', 
                           'download_url', 'file_size', 'file_type', 'changes_description', 
                           'reason', 'tags', 'created_by', 'created_at', 'is_current')
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_download_url(self, obj):
        """Get download URL for this specific version"""
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f'/api/documents/{obj.document.id}/versions/{obj.id}/download/')
        return f'/api/documents/{obj.document.id}/versions/{obj.id}/download/'
    
    def get_is_current(self, obj):
        """Check if this version is the current active version"""
        return obj.document.current_version_id == obj.id