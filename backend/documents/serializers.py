from rest_framework import serializers
from .models import Document, DocumentVersion, Tag, DocumentAccess
from accounts.serializers import UserProfileSerializer


class TagSerializer(serializers.ModelSerializer):
    """Serializer for Tag model"""
    documents_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Tag
        fields = ('id', 'name', 'color', 'documents_count', 'created_at', 'created_by')
        read_only_fields = ('id', 'created_at', 'created_by')
    
    def get_documents_count(self, obj):
        return obj.documents.count()
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


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
        fields = ('id', 'title', 'description', 'file_url', 'file_size', 
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
        fields = ('id', 'title', 'description', 'file', 'file_url', 'file_size', 
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
    """Serializer for Document creation"""
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )
    
    class Meta:
        model = Document
        fields = ('title', 'description', 'file', 'status', 'tag_ids')
        extra_kwargs = {
            'file': {'required': True}
        }
    
    def validate_file(self, value):
        # File size validation (10MB max)
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('File size cannot exceed 10MB')
        
        # File type validation
        allowed_extensions = ['pdf', 'doc', 'docx', 'txt']
        file_extension = value.name.split('.')[-1].lower()
        if file_extension not in allowed_extensions:
            raise serializers.ValidationError(
                f'File type not supported. Allowed types: {", ".join(allowed_extensions)}'
            )
        
        return value
    
    def create(self, validated_data):
        tag_ids = validated_data.pop('tag_ids', [])
        validated_data['created_by'] = self.context['request'].user
        document = super().create(validated_data)
        
        if tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids, created_by=self.context['request'].user)
            document.tags.set(tags)
        
        return document
