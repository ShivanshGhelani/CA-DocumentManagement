from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User
import pyotp
import qrcode
import io
import base64


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = ('email', 'username', 'first_name', 'last_name', 'job_title', 'purpose', 'hear_about', 'password', 'password_confirm')
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'})
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Must include email and password')
        
        return attrs


class MFASetupSerializer(serializers.Serializer):
    """Serializer for MFA setup"""
    def to_representation(self, user):
        # Generate QR code for MFA setup
        totp_uri = user.get_totp_uri()
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_code_data = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            'secret': user.mfa_secret,
            'qr_code': f"data:image/png;base64,{qr_code_data}",
            'totp_uri': totp_uri
        }


class MFAVerifySerializer(serializers.Serializer):
    """Serializer for MFA verification"""
    token = serializers.CharField(max_length=6, min_length=6)
    
    def validate_token(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('Token must be 6 digits')
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile information"""
    avatar_url = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)  # Non-editable
    username = serializers.CharField(read_only=True)  # Non-editable
    
    class Meta:
        model = User
        fields = (
            'username', 'first_name', 'last_name', 'email', 'job_title', 
            'purpose', 'hear_about', 'avatar', 'avatar_url', 'phone_number',
            'is_mfa_enabled', 'date_joined'
        )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make hear_about read-only if it already has a value
        if self.instance and self.instance.hear_about:
            self.fields['hear_about'].read_only = True
    
    def get_avatar_url(self, obj):
        """Get avatar URL"""
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
        return None
    
    def validate_avatar(self, value):
        """Validate avatar file"""
        if value:
            # Check file size (5MB limit)
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Avatar file size cannot exceed 5MB.")
            
            # Check file type
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
            if value.content_type not in allowed_types:
                raise serializers.ValidationError("Avatar must be a JPEG, PNG, or GIF image.")
        
        return value


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for changing password"""
    old_password = serializers.CharField(
        style={'input_type': 'password'},
        write_only=True
    )
    new_password = serializers.CharField(
        validators=[validate_password],
        style={'input_type': 'password'},
        write_only=True
    )
    confirm_password = serializers.CharField(
        style={'input_type': 'password'},
        write_only=True
    )
    
    def validate_old_password(self, value):
        """Validate old password"""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value
    
    def validate(self, attrs):
        """Validate password confirmation"""
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': "New passwords don't match."
            })
        return attrs
    
    def save(self):
        """Change the user's password"""
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed user serializer for API responses"""
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 
            'job_title', 'purpose', 'hear_about', 'avatar_url', 
            'phone_number', 'is_mfa_enabled', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'email', 'created_at', 'updated_at')
    
    def get_avatar_url(self, obj):
        """Get avatar URL"""
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
        return None
