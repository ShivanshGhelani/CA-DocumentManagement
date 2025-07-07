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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Floating Background Shapes */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-3xl"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-gradient-to-br from-indigo-400/30 to-pink-400/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-gradient-to-br from-cyan-400/30 to-blue-400/30 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Your Account</h1>
            <p className="text-lg text-gray-600">Join us and start managing your documents</p>
          </div>

          {/* Auth Card */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 md:p-12">
            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
              <div className="bg-gray-100/80 backdrop-blur-sm rounded-xl p-1 flex">
                <Link
                  to="/signin"
                  className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-lg transition-all duration-200 hover:bg-white/50"
                >
                  Sign In
                </Link>
                <div className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg">
                  Sign Up
                </div>
              </div>
            </div>

            {/* Error Message */}
            {mutation.isError && (
              <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {mutation.error.response?.data?.message || mutation.error.message || 'Signup failed. Please try again.'}
              </div>
            )}

            {/* Success Message */}
            {mutation.isSuccess && (
              <div className="bg-green-50/80 backdrop-blur-sm border border-green-200/50 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Signup successful! You can now sign in.
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
                <Form className="space-y-6">
                  {/* Username and Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                        Username
                      </label>
                      <Field
                        type="text"
                        name="username"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                        placeholder="Enter your username"
                      />
                      <ErrorMessage name="username" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <Field
                        type="email"
                        name="email"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                        placeholder="Enter your email"
                      />
                      <ErrorMessage name="email" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                  </div>

                  {/* Password Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Field
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          className="w-full px-4 py-3 pr-12 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                          placeholder="Enter your password"
                          onChange={(e) => {
                            handleChange(e);
                            setPasswordStrength(calculatePasswordStrength(e.target.value));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {values.password && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                passwordStrength < 50 ? 'bg-red-500' : 
                                passwordStrength < 75 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${passwordStrength}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Password strength: {passwordStrength < 50 ? 'Weak' : passwordStrength < 75 ? 'Medium' : 'Strong'}
                          </p>
                        </div>
                      )}
                      <ErrorMessage name="password" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <Field
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                        placeholder="Confirm your password"
                      />
                      <ErrorMessage name="confirmPassword" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <Field
                        type="text"
                        name="firstName"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                        placeholder="Enter your first name"
                      />
                      <ErrorMessage name="firstName" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                      </label>
                      <Field
                        type="text"
                        name="lastName"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                        placeholder="Enter your last name"
                      />
                      <ErrorMessage name="lastName" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                  </div>

                  {/* Job Title */}
                  <div>
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-2">
                      Job Title
                    </label>
                    <Field
                      as="input"
                      name="jobTitle"
                      list="jobTitlesData"
                      className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                      placeholder="Select or enter your job title"
                    />
                    <datalist id="jobTitlesData">
                      {jobTitles.map((title) => <option key={title} value={title} />)}
                    </datalist>
                    <ErrorMessage name="jobTitle" component="div" className="text-red-600 text-sm mt-1" />
                  </div>

                  {/* Additional Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="hearAbout" className="block text-sm font-medium text-gray-700 mb-2">
                        How did you hear about us?
                      </label>
                      <Field
                        as="input"
                        name="hearAbout"
                        list="hearAboutOptionsData"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                        placeholder="Select an option"
                      />
                      <datalist id="hearAboutOptionsData">
                        {hearAboutOptions.map((option) => <option key={option} value={option} />)}
                      </datalist>
                      <ErrorMessage name="hearAbout" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                    <div>
                      <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-2">
                        How will you use this tool?
                      </label>
                      <Field
                        as="input"
                        name="purpose"
                        list="purposesData"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-300/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-white/70"
                        placeholder="Select your purpose"
                      />
                      <datalist id="purposesData">
                        {purposes.map((purpose) => <option key={purpose} value={purpose} />)}
                      </datalist>
                      <ErrorMessage name="purpose" component="div" className="text-red-600 text-sm mt-1" />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || mutation.isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl text-lg font-medium shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isSubmitting || mutation.isLoading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Account...
                      </div>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </Form>
              )}
            </Formik>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/signin" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
