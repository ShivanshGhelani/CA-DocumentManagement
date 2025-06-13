import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../services/axios';

const MFASchema = Yup.object().shape({
  code: Yup.string().required('Verification code is required'),
});

const verifyCode = async ({ code }) => {
  const { data } = await apiClient.post('/auth/mfa', { code }); // adjust endpoint
  return data;
};

function MFAPage() {
  const mutation = useMutation({ mutationFn: verifyCode });
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">MFA Verification</h2>
          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {mutation.error.response?.data?.message || mutation.error.message || 'Verification failed. Please try again.'}
            </div>
          )}
          <Formik
            initialValues={{ code: '' }}
            validationSchema={MFASchema}
            onSubmit={(values, { setSubmitting }) => {
              mutation.mutate(values, { onSettled: () => setSubmitting(false) });
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <Field
                    type="text"
                    name="code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <ErrorMessage name="code" component="div" className="text-red-600 text-sm mt-1" />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || mutation.isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors mt-6"
                >
                  {isSubmitting || mutation.isLoading ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </button>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}

export default MFAPage;
