import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import { useNavigate, Link } from 'react-router';

const SigninSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

const signinUser = async (userData) => {
  console.log('Attempting to sign in with:', userData);
  try {
    const response = await authAPI.login(userData);
    console.log('Login response:', response);
    return response;
  } catch (error) {
    console.error('Login function error:', error);
    throw error;
  }
};

const getErrorMessage = (error) => {
  // Handle different types of errors
  if (error.response?.status === 400) {
    const data = error.response.data;
    
    // Check for non_field_errors (most common for validation errors in DRF)
    if (data?.non_field_errors && Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return data.non_field_errors[0];
    }
    
    // Check for direct error message
    if (data?.message) {
      return data.message;
    }
    
    // Check for detail field
    if (data?.detail) {
      return data.detail;
    }
    
    // Check if error is directly in the data as an array
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    
    // Check if error is a string in the data
    if (typeof data === 'string') {
      return data;
    }
    
    // Check for field-specific errors
    if (data?.email && Array.isArray(data.email) && data.email.length > 0) {
      return data.email[0];
    }
    if (data?.password && Array.isArray(data.password) && data.password.length > 0) {
      return data.password[0];
    }
    
    // Fallback for any other validation errors - get the first error from any field
    const firstErrorKey = Object.keys(data || {}).find(key => 
      Array.isArray(data[key]) && data[key].length > 0
    );
    if (firstErrorKey) {
      return data[firstErrorKey][0];
    }
    
    return 'Invalid email or password. Please check your credentials.';
  }

  if (error.response?.status === 401) {
    return 'Invalid email or password. Please check your credentials.';
  }

  if (error.response?.status === 403) {
    return 'Account access denied. Please contact support.';
  }

  if (error.response?.status === 429) {
    return 'Too many login attempts. Please try again later.';
  }

  if (error.response?.status >= 500) {
    return 'Server error. Please try again later.';
  }

  if (error.message?.includes('Network Error')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Default fallback
  return 'Sign in failed. Please try again.';
};

function SigninPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: signinUser,
    onSuccess: (data) => {
      console.log('Signin successful:', data);
      console.log('Data structure:', JSON.stringify(data, null, 2));

      // Check if MFA is required
      if (data.requires_mfa) {
        // Store temp data for MFA verification
        localStorage.setItem('mfa_user_id', data.user_id);
        navigate('/mfa');
      } else if (data.tokens && data.tokens.access) {
        // Normal login flow
        localStorage.setItem('access_token', data.tokens.access);
        localStorage.setItem('refresh_token', data.tokens.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/documents');
      } else {
        console.error('Unexpected response structure:', data);
        // Fallback - check if tokens exist in different structure
        if (data.access) {
          localStorage.setItem('access_token', data.access);
          localStorage.setItem('refresh_token', data.refresh);
          localStorage.setItem('user', JSON.stringify(data.user));
          navigate('/documents');
        }
      }
    },
    onError: (error) => {
      console.error('Signin error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data,
        config: error.config
      });
    },
  });

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center">
      {/* Main Content */}
      <div className="w-full max-w-md mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Sign In</h1>
          <p className="text-gray-600">Enter your credentials to access your account</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Error Message */}
          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {getErrorMessage(mutation.error)}
            </div>
          )}

          {/* Login Form */}
          <Formik
            initialValues={{
              email: '',
              password: '',
            }}
            validationSchema={SigninSchema}
            onSubmit={(values, { setSubmitting }) => {
              mutation.mutate(values, {
                onSettled: () => {
                  setSubmitting(false);
                }
              });
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Field
                    type="email"
                    name="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                  <ErrorMessage name="email" component="div" className="text-red-600 text-sm mt-1" />
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Field
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (

                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <ErrorMessage name="password" component="div" className="text-red-600 text-sm mt-1" />
                </div>

                {/* Forgot Password Link */}
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Forgot your password?
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || mutation.isLoading}
                  className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting || mutation.isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </Form>
            )}
          </Formik>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SigninPage;
