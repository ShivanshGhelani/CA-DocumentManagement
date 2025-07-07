import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import { useNavigate, Link } from 'react-router';

// Sample data for autocompletes
const jobTitles = ['Software Engineer', 'Product Manager', 'UX Designer', 'Data Scientist', 'Marketing Specialist', 'Sales Representative', 'Customer Support', 'Other'];
const hearAboutOptions = ['Social Media', 'Friend or Colleague', 'Search Engine', 'Advertisement', 'Conference/Event', 'Other'];
const purposes = ['Work/Business', 'Personal Projects', 'Learning/Education', 'Collaboration', 'Other'];

const SignupSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username can be at most 20 characters')
    .matches(/^[a-zA-Z0-9]+$/, 'Username must be alphanumeric')
    .required('Username is required'),
  email: Yup.string()
    .email('Invalid email format')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm Password is required'),
  firstName: Yup.string().required('First Name is required'),
  lastName: Yup.string().required('Last Name is required'),
  jobTitle: Yup.string().required('Job Title is required'),
  hearAbout: Yup.string().required('This field is required'),
  purpose: Yup.string().required('Purpose is required'),
});

const calculatePasswordStrength = (password) => {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[0-9]/.test(password)) strength += 25;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 25;
  return strength;
};

const signupUser = async (userData) => {
  const response = await authAPI.register(userData);
  return response;
};

function SignupPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const mutation = useMutation({
    mutationFn: signupUser,
    onSuccess: (data) => {
      console.log('Signup successful:', data);
      localStorage.setItem('access_token', data.tokens.access);
      localStorage.setItem('refresh_token', data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/documents');
    },
    onError: (error) => {
      console.error('Signup error:', error.response?.data || error.message);
    },
  });

  return (
    <div className="bg-gray-50 flex items-center justify-center mx-20 my-20">
      {/* Main Content */}
      <div className="w-xl max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Join us and start managing your documents</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        </div>
          </div>

          {/* Error/Success Messages */}
          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {mutation.error.response?.data?.message || mutation.error.message || 'Signup failed. Please try again.'}
            </div>
          )}

          {mutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Account created successfully! You can now sign in.
            </div>
          )}

          {/* Signup Form */}
          <Formik
            initialValues={{
              username: '',
              email: '',
              password: '',
              confirmPassword: '',
              firstName: '',
              lastName: '',
              jobTitle: '',
              hearAbout: '',
              purpose: '',
            }}
            validationSchema={SignupSchema}
            onSubmit={(values, { setSubmitting }) => {
              const transformedData = {
                username: values.username,
                email: values.email,
                password: values.password,
                password_confirm: values.confirmPassword,
                first_name: values.firstName,
                last_name: values.lastName,
                job_title: values.jobTitle,
                hear_about: values.hearAbout,
                purpose: values.purpose,
              };

              mutation.mutate(transformedData, {
                onSettled: () => {
                  setSubmitting(false);
                }
              });
            }}
          >
            {({ isSubmitting, handleChange, values }) => (
              <Form className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <Field
                      type="text"
                      name="username"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter username"
                    />
                    <ErrorMessage name="username" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <Field
                      type="email"
                      name="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter email"
                    />
                    <ErrorMessage name="email" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <Field
                      type="text"
                      name="firstName"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="First name"
                    />
                    <ErrorMessage name="firstName" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <Field
                      type="text"
                      name="lastName"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Last name"
                    />
                    <ErrorMessage name="lastName" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Field
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter password"
                        onChange={(e) => {
                          handleChange(e);
                          setPasswordStrength(calculatePasswordStrength(e.target.value));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>


                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>

                        )}
                      </button>
                    </div>
                    {values.password && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className={`h-1 rounded-full ${passwordStrength < 50 ? 'bg-red-500' :
                              passwordStrength < 75 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                            style={{ width: `${passwordStrength}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    <ErrorMessage name="password" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <Field
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Confirm password"
                    />
                    <ErrorMessage name="confirmPassword" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                </div>

                <div>
                  <label htmlFor="hearAbout" className="block text-sm font-medium text-gray-700 mb-1">
                    How did you hear about us?
                  </label>
                  <Field
                    as="input"
                    name="hearAbout"
                    list="hearAboutOptionsData"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Select option"
                  />
                  <datalist id="hearAboutOptionsData">
                    {hearAboutOptions.map((option) => <option key={option} value={option} />)}
                  </datalist>
                  <ErrorMessage name="hearAbout" component="div" className="text-red-600 text-sm mt-1" />
                </div>
                {/* Additional Information */}
                <div className="flex gap-4">
                  <div>
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title
                    </label>
                    <Field
                      as="input"
                      name="jobTitle"
                      list="jobTitlesData"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Select or enter job title"
                    />
                    <datalist id="jobTitlesData">
                      {jobTitles.map((title) => <option key={title} value={title} />)}
                    </datalist>
                    <ErrorMessage name="jobTitle" component="div" className="text-red-600 text-sm mt-1" />
                  </div>

                  <div>
                    <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                      Purpose of use
                    </label>
                    <Field
                      as="input"
                      name="purpose"
                      list="purposesData"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Select purpose"
                    />
                    <datalist id="purposesData">
                      {purposes.map((purpose) => <option key={purpose} value={purpose} />)}
                    </datalist>
                    <ErrorMessage name="purpose" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting || mutation.isLoading}
                    className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting || mutation.isLoading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>
              </Form>
            )}
          </Formik>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/signin" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

  );
}

export default SignupPage;
