import React, { useState, useRef, useCallback } from 'react';
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
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
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
      const message = error.response?.data?.detail || 'Failed to change password';
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
  });

  // MFA mutations
  const mfaEnableMutation = useMutation({
    mutationFn: authAPI.enableMFA,
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      alert('MFA has been enabled! You will need to enter a 6-digit code on your next login.');
    },
    onError: (error) => {
      console.error('MFA enable error:', error);
      alert('Failed to enable MFA: ' + (error.response?.data?.error || error.message));
    }
  });

  const mfaDisableMutation = useMutation({
    mutationFn: authAPI.disableMFA,
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      alert('MFA has been disabled');
    },
    onError: (error) => {
      console.error('MFA disable error:', error);
      alert('Failed to disable MFA: ' + (error.response?.data?.error || error.message));
    }
  });

  // Handle MFA toggle
  const handleMFAToggle = () => {
    if (profile?.is_mfa_enabled) {
      mfaDisableMutation.mutate();
    } else {
      mfaEnableMutation.mutate();
    }
  };

  // Check authentication and redirect if necessary
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/signin');
    }
  }, [authLoading, isAuthenticated, navigate]);
  // Function to create cropped image
  const getCroppedImg = useCallback((image, crop) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!crop || !ctx) {
      console.error('Missing crop or canvas context:', { crop, ctx });
      return null;
    }

    console.log('Cropping image with:', { crop, imageSize: { width: image.width, height: image.height } });

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          return;
        }
        console.log('Successfully created blob:', { size: blob.size, type: blob.type });
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  }, []);

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageToCrop(e.target.result);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };
  // Handle crop complete
  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop) {
      console.log('Missing imgRef or completedCrop:', { imgRef: !!imgRef.current, completedCrop });
      return;
    }

    console.log('Starting crop completion with:', completedCrop);
    const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
    if (croppedImageBlob) {
      const file = new File([croppedImageBlob], 'avatar.jpg', { type: 'image/jpeg' });
      console.log('Created file:', { name: file.name, size: file.size, type: file.type });
      setCroppedFile(file);
      setShowCropModal(false);
      
      // Upload the cropped image - pass the file directly, not FormData
      avatarUploadMutation.mutate(file);
    } else {
      console.error('Failed to create cropped image blob');
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

  // Loading states
  if (authLoading || profileLoading) {
    return (
      <div>
        <Navigation />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
      <div>
        <Navigation />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-blue-600 px-6 py-4">
              <h1 className="text-2xl font-bold text-white">User Profile</h1>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'profile'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'password'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Change Password
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="max-w-2xl mx-auto">
                  <Formik
                    initialValues={{
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
                      <Form className="space-y-6">
                        {/* Avatar Section */}
                        <div className="text-center">
                          <div className="relative inline-block">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 mx-auto mb-4">
                              {profile?.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt="Profile"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex justify-center space-x-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileSelect}
                              accept="image/*"
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                              Change Photo
                            </button>
                            {profile?.avatar_url && (
                              <button
                                type="button"
                                onClick={() => avatarDeleteMutation.mutate()}
                                disabled={avatarDeleteMutation.isPending}
                                className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                              >
                                {avatarDeleteMutation.isPending ? 'Deleting...' : 'Remove'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                              First Name *
                            </label>
                            <Field
                              name="first_name"
                              type="text"
                              className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter your first name"
                            />
                            <ErrorMessage name="first_name" component="div" className="mt-2 text-sm text-red-600" />
                          </div>

                          <div>
                            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                              Last Name *
                            </label>
                            <Field
                              name="last_name"
                              type="text"
                              className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter your last name"
                            />
                            <ErrorMessage name="last_name" component="div" className="mt-2 text-sm text-red-600" />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-2">
                            Job Title
                          </label>
                          <Field
                            name="job_title"
                            type="text"
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="What's your job title?"
                          />
                          <ErrorMessage name="job_title" component="div" className="mt-2 text-sm text-red-600" />
                        </div>

                        <div>
                          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-2">
                            Purpose
                          </label>
                          <Field
                            as="textarea"
                            name="purpose"
                            rows={3}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="What do you plan to use this system for?"
                          />
                          <ErrorMessage name="purpose" component="div" className="mt-2 text-sm text-red-600" />
                        </div>

                        <div>
                          <label htmlFor="hear_about" className="block text-sm font-medium text-gray-700 mb-2">
                            How did you hear about us?
                          </label>
                          <Field
                            name="hear_about"
                            type="text"
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="How did you hear about us?"
                          />
                          <ErrorMessage name="hear_about" component="div" className="mt-2 text-sm text-red-600" />
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isSubmitting || profileMutation.isPending}
                            className="px-6 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {profileMutation.isPending ? 'Updating...' : 'Update Profile'}
                          </button>
                        </div>
                      </Form>
                    )}
                  </Formik>
                </div>
              )}

              {/* Password Tab */}
              {activeTab === 'password' && (
                <div className="max-w-2xl mx-auto">
                  <Formik
                    initialValues={{
                      old_password: '',
                      new_password: '',
                      confirm_password: '',
                    }}
                    validationSchema={passwordSchema}
                    onSubmit={(values, { setSubmitting, resetForm }) => {
                      passwordMutation.mutate(values, {
                        onSuccess: () => {
                          resetForm();
                          setPasswordStrength(null);
                        },
                        onSettled: () => setSubmitting(false),
                      });
                    }}
                  >
                    {({ isSubmitting, values, setFieldValue }) => (
                      <Form className="space-y-6">
                        <div>
                          <label htmlFor="old_password" className="block text-sm font-medium text-gray-700 mb-2">
                            Current Password *
                          </label>
                          <div className="relative">
                            <Field
                              name="old_password"
                              type={showPasswords.current ? 'text' : 'password'}
                              className="block w-full pr-10 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter your current password"
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                            >
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {showPasswords.current ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                )}
                              </svg>
                            </button>
                          </div>
                          <ErrorMessage name="old_password" component="div" className="mt-2 text-sm text-red-600" />
                        </div>

                        <div>
                          <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-2">
                            New Password *
                          </label>
                          <div className="relative">
                            <Field
                              name="new_password"
                              type={showPasswords.new ? 'text' : 'password'}
                              className="block w-full pr-10 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter your new password"
                              onChange={(e) => {
                                setFieldValue('new_password', e.target.value);
                                setPasswordStrength(checkPasswordStrength(e.target.value));
                              }}
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                            >
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {showPasswords.new ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                )}
                              </svg>
                            </button>
                          </div>
                          <ErrorMessage name="new_password" component="div" className="mt-2 text-sm text-red-600" />
                          
                          {/* Password Strength Indicator */}
                          {passwordStrength && values.new_password && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">Password strength</span>
                                <span className={`text-sm font-medium ${
                                  passwordStrength.strength === 'weak' ? 'text-red-600' :
                                  passwordStrength.strength === 'medium' ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    passwordStrength.strength === 'weak' ? 'bg-red-500 w-1/3' :
                                    passwordStrength.strength === 'medium' ? 'bg-yellow-500 w-2/3' : 'bg-green-500 w-full'
                                  }`}
                                />
                              </div>
                              <div className="mt-2 text-sm text-gray-600 space-y-1">
                                <div className="grid grid-cols-2 gap-2">
                                  <span className={`flex items-center ${passwordStrength.checks.length ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    8+ characters
                                  </span>
                                  <span className={`flex items-center ${passwordStrength.checks.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Uppercase
                                  </span>
                                  <span className={`flex items-center ${passwordStrength.checks.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Lowercase
                                  </span>
                                  <span className={`flex items-center ${passwordStrength.checks.number ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Number
                                  </span>
                                  <span className={`flex items-center ${passwordStrength.checks.special ? 'text-green-600' : 'text-gray-400'}`}>
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Special char
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-2">
                            Confirm New Password *
                          </label>
                          <div className="relative">
                            <Field
                              name="confirm_password"
                              type={showPasswords.confirm ? 'text' : 'password'}
                              className="block w-full pr-10 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Confirm your new password"
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                            >
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {showPasswords.confirm ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                )}
                              </svg>
                            </button>
                          </div>
                          <ErrorMessage name="confirm_password" component="div" className="mt-2 text-sm text-red-600" />
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isSubmitting || passwordMutation.isPending}
                            className="px-6 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
                          </button>
                        </div>
                      </Form>
                    )}
                  </Formik>
                </div>
              )}
            </div>
          </div>

          {/* MFA Section - Separate from tabs */}
          <div className="bg-white shadow-lg rounded-lg overflow-hidden mt-6">
            <div className="bg-blue-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white">Security Settings</h2>
            </div>
            <div className="p-6">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center mb-6">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${profile?.is_mfa_enabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">SMS Authentication</h4>
                        <p className="text-sm text-gray-600">
                          {profile?.is_mfa_enabled 
                            ? 'Receive 6-digit codes via SMS during login' 
                            : 'Get security codes sent to your phone'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleMFAToggle}
                      disabled={mfaEnableMutation.isPending || mfaDisableMutation.isPending}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        profile?.is_mfa_enabled
                          ? 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                          : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      {(mfaEnableMutation.isPending || mfaDisableMutation.isPending) ? 'Processing...' : (profile?.is_mfa_enabled ? 'Disable' : 'Enable')}
                    </button>
                  </div>

                  {profile?.is_mfa_enabled && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="text-sm">
                          <h4 className="font-medium text-green-800">MFA is Active</h4>
                          <p className="text-green-700">Your account is protected with two-factor authentication</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">How it works:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• When you sign in, you'll receive a 6-digit code</li>
                      <li>• Enter the code to complete your login</li>
                      <li>• Codes expire after 5 minutes for security</li>
                      <li>• Super users can use PIN: 123456</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Crop Your Profile Picture</h3>
              <button
                onClick={handleCropCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Drag to reposition and use the corners to resize your image. The image will be cropped to a perfect circle.
              </p>
            </div>

            <div className="flex justify-center mb-6">
              {imageToCrop && (
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => {
                    setCompletedCrop(c);
                  }}
                  aspect={1}
                  minWidth={100}
                  minHeight={100}
                  keepSelection={true}
                  className="max-w-full max-h-96"
                >
                  <img
                    ref={imgRef}
                    alt="Crop"
                    src={imageToCrop}
                    className="max-w-full max-h-96"
                    onLoad={() => {
                      // Set initial crop when image loads
                      const { width, height } = imgRef.current;
                      const cropSize = Math.min(width, height) * 0.8;
                      const x = (width - cropSize) / 2;
                      const y = (height - cropSize) / 2;
                      const initialCrop = {
                        unit: 'px',
                        width: cropSize,
                        height: cropSize,
                        x: x,
                        y: y,
                        aspect: 1,
                      };
                      
                      setCrop(initialCrop);
                      setCompletedCrop(initialCrop); // Also set completedCrop
                    }}
                  />
                </ReactCrop>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCropCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCropComplete}
                disabled={!completedCrop}
                className="px-6 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
