import React, { useState, useRef, useCallback, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router';
import { authAPI } from '../services/api';
import Navigation from '../components/Navigation';
import { useAuth } from '../hooks/useAuth.jsx';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Password strength checker
const checkPasswordStrength = (password) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  let strength = 'weak';
  if (score >= 4) strength = 'strong';
  else if (score >= 3) strength = 'medium';

  return { checks, score, strength };
};

// Validation schemas
const profileSchema = Yup.object().shape({
  first_name: Yup.string().required('First name is required'),
  last_name: Yup.string().required('Last name is required'),
  job_title: Yup.string(),
  purpose: Yup.string(),
  hear_about: Yup.string(),
});

const passwordSchema = Yup.object().shape({
  old_password: Yup.string().required('Current password is required'),
  new_password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('New password is required'),
  confirm_password: Yup.string()
    .oneOf([Yup.ref('new_password')], 'Passwords must match')
    .required('Please confirm your password'),
});

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null); const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  }); const [showAvatarEdit, setShowAvatarEdit] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Image cropping states
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25,
    aspect: 1, // Square crop
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [croppedFile, setCroppedFile] = useState(null);

  // Generate initials from user name
  const getInitials = (profile) => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name.charAt(0).toUpperCase()}${profile.last_name.charAt(0).toUpperCase()}`;
    } else if (profile?.first_name) {
      return profile.first_name.charAt(0).toUpperCase();
    } else if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    } else if (profile?.email) {
      return profile.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Fetch user profile data
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['profile'],
    queryFn: authAPI.getProfile,
    enabled: isAuthenticated,
  });

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: authAPI.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      alert('Profile updated successfully!');
    },
    onError: (error) => {
      console.error('Profile update error:', error);
      const message = error.response?.data?.detail || 'Failed to update profile';
      alert(message);
    }
  });

  // Password mutation  
  const passwordMutation = useMutation({
    mutationFn: authAPI.changePassword,
    onSuccess: () => {
      alert('Password changed successfully!');
    },
    onError: (error) => {
      console.error('Password change error:', error);
      const message = error.response?.data?.detail || 'Failed to change password check your current password';
      alert(message);
    }
  });

  // Avatar upload mutation
  const avatarUploadMutation = useMutation({
    mutationFn: authAPI.uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      setAvatarPreview(null);
      setCroppedFile(null);
      setShowCropModal(false);
      alert('Avatar updated successfully!');
    },
    onError: (error) => {
      console.error('Avatar upload error:', error);
      console.error('Error response:', error.response?.data);
      const message = error.response?.data?.detail || error.response?.data?.error || 'Failed to upload avatar';
      alert(message);
    }
  });

  // Avatar delete mutation
  const avatarDeleteMutation = useMutation({
    mutationFn: authAPI.deleteAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      alert('Avatar deleted successfully!');
    },
    onError: (error) => {
      console.error('Avatar delete error:', error);
      const message = error.response?.data?.detail || 'Failed to delete avatar';
      alert(message);
    }
  });  // MFA mutations
  const mfaEnableMutation = useMutation({
    mutationFn: () => authAPI.enableMFA(), // Remove token parameter
    onSuccess: async () => {
      queryClient.invalidateQueries(['profile']);
      alert('MFA has been enabled! Generate backup codes to secure your account.');
    },
    onError: (error) => {
      console.error('MFA enable error:', error);
      const message = error.response?.data?.detail || 'Failed to enable MFA';
      alert(message);
    }
  });

  const mfaDisableMutation = useMutation({
    mutationFn: authAPI.disableMFA,
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      // Clear the backup codes when disabled
      setBackupCodes([]);
      setShowBackupCodes(false);
      alert('MFA has been disabled.');
    },
    onError: (error) => {
      console.error('MFA disable error:', error);
      const message = error.response?.data?.detail || 'Failed to disable MFA';
      alert(message);
    }
  });

  // Backup codes functions
  const generateBackupCodes = async () => {
    try {
      const response = await authAPI.generateBackupCodes();
      setBackupCodes(response.backup_codes);
      setShowBackupCodes(true);
      alert(`${response.backup_codes.length} backup codes generated! Please save them securely.`);
    } catch (error) {
      console.error('Failed to generate backup codes:', error);
      alert('Failed to generate backup codes. Please try again.');
    }
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([
      `Document Management System - MFA Backup Codes\n` +
      `Generated: ${new Date().toLocaleString()}\n` +
      `User: ${profile?.email}\n\n` +
      `IMPORTANT: Save these codes in a secure location.\n` +
      `Each code can only be used once.\n\n` +
      `Backup Codes:\n${codesText}\n\n` +
      `Note: Do not share these codes with anyone.`
    ], { type: 'text/plain' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mfa-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Don't auto-generate MFA codes on page load
  // Codes should only be generated when explicitly requested by the user  // File selection handler
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Close the avatar edit dropdown
    setShowAvatarEdit(false);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Crop image utility
  const getCroppedImg = useCallback((image, crop) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio;

    canvas.width = crop.width * pixelRatio * scaleX;
    canvas.height = crop.height * pixelRatio * scaleY;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  }, []);

  // Handle crop completion
  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop) return;

    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });

      // Upload the cropped image - pass the file directly, not FormData
      avatarUploadMutation.mutate(file);
    } catch (error) {
      console.error('Failed to create cropped image blob:', error);
    }
  };

  // Handle crop cancel
  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    setCrop({
      unit: '%',
      width: 50,
      height: 50,
      x: 25,
      y: 25,
      aspect: 1,
    });
    setCompletedCrop(null);
  };

  // Close avatar edit dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAvatarEdit && !event.target.closest('.avatar-edit-container')) {
        setShowAvatarEdit(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAvatarEdit]);

  // Authentication check
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/signin');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Loading states
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Navigation />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (profileError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Navigation />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading profile</p>
            <button
              onClick={() => queryClient.invalidateQueries(['profile'])}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navigation />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">            {/* Avatar Section */}
            <div className="relative group avatar-edit-container">
              <div
                className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-white shadow-2xl ring-4 ring-white/20 cursor-pointer"
                onClick={() => setShowAvatarEdit(!showAvatarEdit)}
              >                {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-6xl md:text-7xl">
                  {getInitials(profile)}
                </div>
              )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-full">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>

              {/* Edit Dropdown */}
              {showAvatarEdit && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-10">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                  />                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 002-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {profile?.avatar_url ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {profile?.avatar_url && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to remove your profile photo?')) {
                          avatarDeleteMutation.mutate();
                        }
                        setShowAvatarEdit(false);
                      }}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors duration-200 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove Photo
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : profile?.username || 'User Profile'
                }
              </h1>
              <p className="text-blue-100 text-lg mb-2">{profile?.email}</p>
              {profile?.job_title && (
                <p className="text-blue-200 font-medium">{profile.job_title}</p>
              )}              <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 mt-4">
                <div className="flex items-center text-blue-100">
                  Member since {profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-lg">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Personal Information
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'password'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 012 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Security
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex-1 flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'security'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Two-Factor Auth
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Personal  Information</h2>
                  <p className="text-gray-600">Update your account details and personal information.</p>
                </div>

                <Formik
                  initialValues={{
                    username: profile?.username || '',
                    first_name: profile?.first_name || '',
                    last_name: profile?.last_name || '',
                    job_title: profile?.job_title || '',
                    purpose: profile?.purpose || '',
                    hear_about: profile?.hear_about || '',
                  }}
                  validationSchema={profileSchema}
                  enableReinitialize
                  onSubmit={(values, { setSubmitting }) => {
                    profileMutation.mutate(values, {
                      onSettled: () => setSubmitting(false),
                    });
                  }}
                >
                  {({ isSubmitting, values }) => (
                    <Form className="space-y-8">
                      {/* Basic Information Card */}
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Basic Information
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div>

                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              First Name *
                            </label>
                            <Field
                              type="text"
                              name="first_name"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your first name"
                            />
                            <ErrorMessage name="first_name" component="div" className="text-red-500 text-sm mt-1" />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Last Name *
                            </label>
                            <Field
                              type="text"
                              name="last_name"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your last name"
                            />
                            <ErrorMessage name="last_name" component="div" className="text-red-500 text-sm mt-1" />
                          </div>
                        </div>
                        { /* Username and Email Card */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Username *
                            </label>
                            <Field
                              type="text"
                              name="username"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your username"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Email Address
                            </label>
                            <div className="relative flex flex-1 items-center space-x-2">
                              <input
                                type="email"
                                value={profile?.email || ''}
                                disabled
                                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                                placeholder="Email cannot be changed"

                              />
                              <div className="flex items-center justify-center p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors duration-200 cursor-not-allowed">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 012 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Email cannot be changed for security reasons</p>
                          </div>
                        </div>
                      </div>

                      {/* Professional Information Card */}
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V6a2 2 0 00-2 2H8a2 2 0 00-2-2V6" />
                          </svg>
                          Professional Information
                        </h3>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Job Title
                          </label>
                          <Field
                            type="text"
                            name="job_title"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder="e.g., Software Engineer, Product Manager"
                          />
                          <ErrorMessage name="job_title" component="div" className="text-red-500 text-sm mt-1" />
                        </div>
                      </div>

                      {/* Additional Information Card */}
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Additional Information
                        </h3>

                        <div className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Purpose
                            </label>
                            <Field
                              as="textarea"
                              name="purpose"
                              rows={1}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              placeholder="What do you plan to use this system for?"
                            />
                            <ErrorMessage name="purpose" component="div" className="text-red-500 text-sm mt-1" />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              How did you hear about us?
                            </label>
                            <Field
                              type="text"
                              name="hear_about"
                              disabled={!!profile?.hear_about}
                              className={`w-full px-4 py-3 border border-gray-300 rounded-lg transition-all duration-200 ${profile?.hear_about
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                }`}
                              placeholder={profile?.hear_about ? '' : "e.g., Google search, friend referral, social media"}
                            />
                            {profile?.hear_about && (
                              <p className="text-xs text-gray-500 mt-1">This field cannot be changed once set</p>
                            )}
                            <ErrorMessage name="hear_about" component="div" className="text-red-500 text-sm mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || profileMutation.isPending}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-all duration-200 font-medium flex items-center"
                        >
                          {isSubmitting || profileMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Change Password</h2>
                  <p className="text-gray-600">Ensure your account is using a long, random password to stay secure.</p>
                </div>

                <Formik
                  initialValues={{
                    old_password: '',
                    new_password: '',
                    confirm_password: '',
                  }}
                  validationSchema={passwordSchema}
                  onSubmit={(values, { setSubmitting, resetForm }) => {
                    passwordMutation.mutate(values, {
                      onSettled: () => {
                        setSubmitting(false);
                        resetForm();
                        setPasswordStrength(null);
                      },
                    });
                  }}
                >
                  {({ isSubmitting, values, setFieldValue }) => (
                    <Form className="space-y-8">
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 012 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Password Security
                        </h3>

                        <div className="space-y-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Current Password *
                            </label>
                            <div className="relative">
                              <Field
                                type={showPasswords.current ? "text" : "password"}
                                name="old_password"
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Enter your current password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              >
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPasswords.current ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                                </svg>
                              </button>
                            </div>
                            <ErrorMessage name="old_password" component="div" className="text-red-500 text-sm mt-1" />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              New Password *
                            </label>
                            <div className="relative">
                              <Field
                                type={showPasswords.new ? "text" : "password"}
                                name="new_password"
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Enter your new password"
                                onChange={(e) => {
                                  setFieldValue('new_password', e.target.value);
                                  setPasswordStrength(checkPasswordStrength(e.target.value));
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              >
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPasswords.new ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                                </svg>
                              </button>
                            </div>
                            <ErrorMessage name="new_password" component="div" className="text-red-500 text-sm mt-1" />

                            {/* Password Strength Indicator */}
                            {passwordStrength && values.new_password && (
                              <div className="mt-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-gray-700">Password strength:</span>
                                  <span className={`text-sm font-medium ${passwordStrength.strength === 'strong' ? 'text-green-600' :
                                    passwordStrength.strength === 'medium' ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                    {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.strength === 'strong' ? 'bg-green-500 w-full' :
                                      passwordStrength.strength === 'medium' ? 'bg-yellow-500 w-2/3' : 'bg-red-500 w-1/3'
                                      }`}
                                  ></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                  <div className={`flex items-center ${passwordStrength.checks.length ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    8+ characters
                                  </div>
                                  <div className={`flex items-center ${passwordStrength.checks.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Uppercase letter
                                  </div>
                                  <div className={`flex items-center ${passwordStrength.checks.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Lowercase letter
                                  </div>
                                  <div className={`flex items-center ${passwordStrength.checks.number ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Number
                                  </div>
                                  <div className={`flex items-center ${passwordStrength.checks.special ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Special character
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Confirm New Password *
                            </label>
                            <div className="relative">
                              <Field
                                type={showPasswords.confirm ? "text" : "password"}
                                name="confirm_password"
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Confirm your new password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              >
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPasswords.confirm ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                                </svg>
                              </button>
                            </div>
                            <ErrorMessage name="confirm_password" component="div" className="text-red-500 text-sm mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordStrength(null);
                            window.location.reload();
                          }}
                          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || passwordMutation.isPending}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-all duration-200 font-medium flex items-center"
                        >
                          {isSubmitting || passwordMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Updating...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Update Password
                            </>
                          )}
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
            )}            {/* Security Tab */}
            {activeTab === 'security' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h2>
                  <p className="text-gray-600">Add an extra layer of security to your account with two-factor authentication.</p>
                </div>

                <div className="space-y-6">
                  {/* MFA Status Card */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${profile?.is_mfa_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <svg className={`w-6 h-6 ${profile?.is_mfa_enabled ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Two-Factor Authentication {profile?.is_mfa_enabled ? 'Enabled' : 'Disabled'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {profile?.is_mfa_enabled
                            ? 'Your account is protected with two-factor authentication. You will need to enter a 6-digit code when signing in.'
                            : 'Enable two-factor authentication to add an extra layer of security to your account.'
                          }
                        </p>

                        <div className="flex space-x-3">
                          {profile?.is_mfa_enabled ? (
                            <button onClick={() => {
                              if (confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
                                mfaDisableMutation.mutate();
                              }
                            }}
                              disabled={mfaDisableMutation.isPending}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-all duration-200 font-medium flex items-center"
                            >
                              {mfaDisableMutation.isPending ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Disabling...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Disable 2FA
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => mfaEnableMutation.mutate()}
                              disabled={mfaEnableMutation.isPending}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-all duration-200 font-medium flex items-center"
                            >
                              {mfaEnableMutation.isPending ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Enabling...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  Enable 2FA
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>                  {/* MFA Backup Codes Section - Only show when MFA is enabled */}
                  {profile?.is_mfa_enabled && (
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                        </div>

                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Two-Factor Authentication Active
                          </h3>
                          <p className="text-gray-600 mb-4">
                            Your account is protected with 2FA. Generate backup codes to ensure you can always access your account.
                          </p>

                          {/* Backup Codes Section */}
                          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">Backup Codes</h4>
                            <p className="text-gray-600 mb-3">
                              Generate backup codes that you can use for login when you don't have access to your primary device.
                            </p>

                            <div className="flex space-x-3">
                              <button
                                onClick={generateBackupCodes}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 font-medium flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Generate Backup Codes
                              </button>

                              {backupCodes.length > 0 && (
                                <button
                                  onClick={downloadBackupCodes}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium flex items-center"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Download Codes
                                </button>
                              )}
                            </div>

                            {/* Show backup codes */}
                            {showBackupCodes && backupCodes.length > 0 && (
                              <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-300">
                                <div className="flex justify-between items-center mb-3">
                                  <h5 className="font-semibold text-gray-900">Your Backup Codes</h5>
                                  <button
                                    onClick={() => setShowBackupCodes(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {backupCodes.map((code, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                      <span className="text-sm text-gray-500">{index + 1}.</span>
                                      <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm">{code}</code>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 text-xs text-red-600">
                                  ⚠️ Save these codes securely. They will not be shown again!
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>      {/* Image Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Crop Your Photo</h3>
              <p className="text-gray-600 mt-1">Adjust the crop area to fit your profile picture</p>
            </div>            <div className="p-6">
              {imageToCrop && (
                <ReactCrop
                  crop={crop}
                  onChange={(newCrop) => setCrop(newCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  className="max-h-96"
                >
                  <img
                    ref={imgRef}
                    src={imageToCrop}
                    alt="Crop preview"
                    className="max-w-full h-auto"
                  />
                </ReactCrop>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={handleCropCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCropComplete}
                disabled={!completedCrop}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                Use Cropped Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
