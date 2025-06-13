import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQuery } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const DocumentCreateSchema = Yup.object().shape({
  title: Yup.string()
    .max(100, 'Title must be 100 characters or less')
    .required('Title is required'),
  description: Yup.string()
    .max(500, 'Description must be 500 characters or less'),
  file: Yup.mixed()
    .required('File is required')
    .test('fileSize', 'File size must be less than 10MB', (value) => {
      return !value || value.size <= 10 * 1024 * 1024;
    })
    .test('fileType', 'Only PDF, DOCX, and TXT files are allowed', (value) => {
      if (!value) return true;
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      return allowedTypes.includes(value.type);
    }),
  status: Yup.string().oneOf(['draft', 'published'], 'Invalid status'),
});

export default function DocumentCreatePage() {
  const navigate = useNavigate();
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Fetch available tags
  const { data: availableTags } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsAPI.getTags,
  });
  
  const mutation = useMutation({ 
    mutationFn: documentsAPI.createDocument,
    onSuccess: () => {
      navigate('/documents');
    },
    onError: (error) => {
      console.error('Document creation failed:', error);
    }
  });

  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">Upload Document</h2>
          
          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {mutation.error?.response?.data?.message || mutation.error?.message || 'Failed to create document. Please try again.'}
            </div>
          )}
          
          <Formik
            initialValues={{
              title: '',
              description: '',
              file: null,
              status: 'draft'
            }}
            validationSchema={DocumentCreateSchema}
            onSubmit={(values, { setSubmitting }) => {
              const formData = {
                ...values,
                tag_ids: selectedTags
              };
              mutation.mutate(formData, { onSettled: () => setSubmitting(false) });
            }}
          >
            {({ isSubmitting, setFieldValue, values }) => (
              <Form className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title
                  </label>
                  <Field
                    type="text"
                    name="title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <ErrorMessage name="title" component="div" className="text-red-600 text-sm mt-1" />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <Field
                    as="textarea"
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <ErrorMessage name="description" component="div" className="text-red-600 text-sm mt-1" />
                </div>

                <div>
                  <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                    File
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(event) => {
                      const file = event.currentTarget.files[0];
                      setFieldValue('file', file);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-gray-500 text-sm mt-1">
                    Supported formats: PDF, DOCX, TXT (max 10MB)
                  </p>
                  <ErrorMessage name="file" component="div" className="text-red-600 text-sm mt-1" />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <Field
                    as="select"
                    name="status"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </Field>
                  <ErrorMessage name="status" component="div" className="text-red-600 text-sm mt-1" />
                </div>

                {availableTags && availableTags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (Optional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleTagToggle(tag.id)}
                          className={`px-3 py-1 text-sm rounded-full border cursor-pointer transition-colors ${
                            selectedTags.includes(tag.id)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                          style={selectedTags.includes(tag.id) ? { 
                            backgroundColor: tag.color, 
                            borderColor: tag.color 
                          } : { 
                            borderColor: tag.color, 
                            color: tag.color 
                          }}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate('/documents')}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || mutation.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md transition-colors"
                  >
                    {isSubmitting || mutation.isPending ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      'Upload Document'
                    )}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}
