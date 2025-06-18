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

function MFAPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [mfaCode, setMfaCode] = useState(null); // For development - shows the generated code

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
    mutationFn: ({ code }) => authAPI.verifyMFA(code, userId),
    onSuccess: (data) => {
      // Store tokens and redirect to dashboard
      localStorage.setItem('access_token', data.tokens.access);
      localStorage.setItem('refresh_token', data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Clear MFA user ID
      localStorage.removeItem('mfa_user_id');
      
      navigate('/documents');
    },
    onError: (error) => {
      console.error('MFA verification failed:', error);
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

          {/* Development notice - remove in production */}
          {mfaCode && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Development Mode</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>Generated MFA Code: <strong>{mfaCode}</strong></p>
                    <p className="text-xs">In production, this would be sent via SMS/Email</p>
                  </div>
                </div>
              </div>
            </div>
          )}

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

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => navigate('/signin')}
                      className="text-sm text-gray-600 hover:text-gray-800 underline"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Need help?</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Check your phone for SMS message</li>
                    <li>• Code expires in 5 minutes</li>
                    <li>• Contact admin if you're having issues</li>
                    <li>• Super users can use PIN: 123456</li>
                  </ul>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}

export default MFAPage;
