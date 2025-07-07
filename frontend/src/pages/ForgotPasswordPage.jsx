import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import { Link } from 'react-router';

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
});

function ForgotPasswordPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const mutation = useMutation({
    mutationFn: authAPI.requestPasswordReset,
    onSuccess: (data, variables) => {
      setEmailSent(true);
      setSentEmail(variables);
    }
  });

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center">
      {/* Main Content */}
      <div className="w-full max-w-md mx-auto p-6">
        {/* Auth Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Reset Password</h2>
            <p className="text-gray-600">
              {emailSent 
                ? "Check your email for reset instructions"
                : "Enter your email to receive a password reset link"
              }
            </p>
          </div>

          {emailSent ? (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Email Sent Successfully!</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>We've sent a password reset link to <strong>{sentEmail}</strong></p>
                      <p className="mt-1">The link will expire in 10 minutes for security reasons.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Link
                  to="/signin"
                  className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 block text-center"
                >
                  Back to Sign In
                </Link>
                
                <button
                  onClick={() => {
                    setEmailSent(false);
                    setSentEmail('');
                  }}
                  className="w-full text-blue-600 hover:text-blue-800 font-medium py-2"
                >
                  Send another email
                </button>
              </div>
            </div>
          ) : (
            <>
              {mutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {mutation.error.response?.data?.error || mutation.error.message || 'Failed to send reset email. Please try again.'}
                </div>
              )}

              <Formik
                initialValues={{ email: '' }}
                validationSchema={ForgotPasswordSchema}
                onSubmit={(values, { setSubmitting }) => {
                  mutation.mutate(values.email, { onSettled: () => setSubmitting(false) });
                }}
              >
                {({ isSubmitting }) => (
                  <Form className="space-y-6">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <Field
                        type="email"
                        name="email"
                        placeholder="Enter your email address"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <ErrorMessage name="email" component="div" className="text-red-600 text-sm mt-1" />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || mutation.isLoading}
                      className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting || mutation.isLoading ? 'Sending Email...' : 'Send Reset Link'}
                    </button>
                  </Form>
                )}
              </Formik>

              <div className="mt-6 text-center">
                <Link
                  to="/signin"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
