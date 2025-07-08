import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router';

const MFASchema = Yup.object().shape({
  code: Yup.string()
    .length(6, 'Code must be 6 digits')
    .matches(/^\d+$/, 'Code must contain only numbers')
    .required('Verification code is required'),
});

const LostCodesSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
});

function MFAPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [showLostCodes, setShowLostCodes] = useState(false);
  const [codesRequested, setCodesRequested] = useState(false);

  useEffect(() => {
    // Get user ID from localStorage (set during login)
    const storedUserId = localStorage.getItem('mfa_user_id');
    if (!storedUserId) {
      navigate('/signin');
      return;
    }
    setUserId(storedUserId);
  }, [navigate]);

  const mutation = useMutation({ 
    mutationFn: ({ code }) => {
      console.log('MFA verification attempt:', { code, userId });
      return authAPI.verifyMFA(code, userId);
    },
    onSuccess: (data) => {
      console.log('MFA verification successful:', data);
      // Store tokens and redirect to dashboard
      localStorage.setItem('access_token', data.tokens.access);
      localStorage.setItem('refresh_token', data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Clear MFA temp data
      localStorage.removeItem('mfa_user_id');
      
      navigate('/documents');
    },
    onError: (error) => {
      console.error('MFA verification failed:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
    }
  });

  const lostCodesMutation = useMutation({
    mutationFn: authAPI.requestMFABackupCodes,
    onSuccess: () => {
      setCodesRequested(true);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg border p-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h2>
            <p className="text-gray-600">Please enter the 6-digit verification code</p>
          </div>

          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              {mutation.error.response?.data?.error || mutation.error.message || 'Verification failed. Please try again.'}
            </div>
          )}

          <Formik
            initialValues={{ code: '' }}
            validationSchema={MFASchema}
            onSubmit={(values, { setSubmitting }) => {
              mutation.mutate(values, { onSettled: () => setSubmitting(false) });
            }}
          >
            {({ isSubmitting, values, setFieldValue }) => (
              <Form className="space-y-6">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                    6-Digit Verification Code
                  </label>
                  <Field
                    type="text"
                    name="code"
                    maxLength="6"
                    placeholder="123456"
                    className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/\D/g, '');
                      setFieldValue('code', value);
                    }}
                  />
                  <ErrorMessage name="code" component="div" className="text-red-600 text-sm mt-1" />
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={isSubmitting || mutation.isLoading || values.code.length !== 6}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    {isSubmitting || mutation.isLoading ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </button>

                  <div className="text-center space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowLostCodes(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      Lost your backup codes?
                    </button>
                    
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate('/signin')}
                        className="text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Need help?</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Check your phone for SMS message</li>
                    <li>• Code expires in 5 minutes</li>
                    <li>• Contact admin if you're having issues</li>
                    <li>• Super users can use PIN: 280804</li>
                  </ul>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>

      {/* Lost Codes Modal */}
      {showLostCodes && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {codesRequested ? 'Backup Codes Sent!' : 'Lost Your Backup Codes?'}
              </h3>
              <p className="text-sm text-gray-600">
                {codesRequested 
                  ? 'New backup codes have been generated and sent to your email.'
                  : 'Enter your email to receive new backup codes'
                }
              </p>
            </div>

            {codesRequested ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">
                        Check your email for 7 new backup codes. Each code can only be used once.
                      </p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setShowLostCodes(false);
                    setCodesRequested(false);
                  }}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {lostCodesMutation.isError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                    {lostCodesMutation.error.response?.data?.error || 'Failed to send backup codes. Please try again.'}
                  </div>
                )}

                <Formik
                  initialValues={{ email: '' }}
                  validationSchema={LostCodesSchema}
                  onSubmit={(values, { setSubmitting }) => {
                    lostCodesMutation.mutate(values.email, { 
                      onSettled: () => setSubmitting(false) 
                    });
                  }}
                >
                  {({ isSubmitting }) => (
                    <Form className="space-y-4">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                        </label>
                        <Field
                          type="email"
                          name="email"
                          placeholder="Enter your email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <ErrorMessage name="email" component="div" className="text-red-600 text-sm mt-1" />
                      </div>

                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowLostCodes(false);
                            setCodesRequested(false);
                          }}
                          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || lostCodesMutation.isLoading}
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmitting || lostCodesMutation.isLoading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Sending...
                            </div>
                          ) : (
                            'Send Codes'
                          )}
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MFAPage;
