import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { documentsAPI, tagsAPI } from '../services/api';

const DocumentEditSchema = Yup.object().shape({
  title: Yup.string()
    .max(100, 'Title must be 100 characters or less')
    .required('Title is required'),
  description: Yup.string()
    .max(500, 'Description must be 500 characters or less'),
  status: Yup.string().oneOf(['draft', 'published'], 'Invalid status'),
});

export default function DocumentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedTags, setSelectedTags] = useState([]);

  // Fetch document data
  const { data: document, isLoading: documentLoading, error: documentError } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsAPI.getDocument(id),
  });

  // Fetch available tags
  const { data: availableTags } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsAPI.getTags,
  });

  // Update mutation
  const mutation = useMutation({
    mutationFn: (data) => documentsAPI.updateDocument(id, data),
    onSuccess: () => {
      navigate(`/documents/${id}`);
    },
  });

  // Set initial values when document loads
  useEffect(() => {
    if (document?.tags) {
      setSelectedTags(document.tags.map(tag => tag.id));
    }
  }, [document]);

  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  if (documentLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (documentError || !document) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Failed to load document or you don't have permission to edit it.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Document</h1>
          <p className="text-gray-600 mt-1">Update document information and metadata</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {mutation.error?.response?.data?.message || mutation.error?.message || 'Failed to update document. Please try again.'}
            </div>
          )}
          
          <Formik
            enableReinitialize
            initialValues={{
              title: document.title || '',
              description: document.description || '',
              status: document.status || 'draft'
            }}
            validationSchema={DocumentEditSchema}
            onSubmit={(values, { setSubmitting }) => {
              const formData = {
                ...values,
                tag_ids: selectedTags
              };
              mutation.mutate(formData, { onSettled: () => setSubmitting(false) });
            }}
          >
            {({ isSubmitting, values }) => (
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

                {/* File Information (Read-only) */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Current File</h3>
                  <div className="text-sm text-gray-600">
                    <p><span className="font-medium">Filename:</span> {document.file_name}</p>
                    <p><span className="font-medium">Size:</span> {(document.file_size / 1024 / 1024).toFixed(2)} MB</p>
                    <p><span className="font-medium">Type:</span> {document.file_type}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Note: To change the file, create a new document version instead.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/documents/${id}`)}
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
                        Updating...
                      </>
                    ) : (
                      'Update Document'
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
