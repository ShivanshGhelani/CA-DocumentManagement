import React, { useState, useRef } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQuery } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import { useNavigate } from 'react-router';
import Navigation from '../components/Navigation';

const DocumentCreateSchema = Yup.object().shape({
  title: Yup.string()
    .max(100, 'Title must be 100 characters or less')
    .required('Title is required'),
  description: Yup.string()
    .max(500, 'Description must be 500 characters or less'),
  content: Yup.string(),
  file: Yup.mixed()
    .test('fileSize', 'File size must be less than 10MB', (value) => {
      return !value || value.size <= 10 * 1024 * 1024;
    })
    .test('fileType', 'Only PDF, DOCX, and TXT files are allowed', (value) => {
      if (!value) return true;
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      return allowedTypes.includes(value.type);
    }),
  status: Yup.string().oneOf(['draft', 'published'], 'Invalid status'),
}).test('contentOrFile', 'Either content or file must be provided', function (values) {
  const { content, file } = values;
  return (content && content.trim()) || file;
});

export default function DocumentCreatePage() {
  const navigate = useNavigate();
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState({ key: '', value: '' });
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef(null);
  
  // Fetch tag suggestions with debouncing
  const { refetch: fetchSuggestions } = useQuery({
    queryKey: ['tagSuggestions', tagInput.key],
    queryFn: () => tagsAPI.getTagSuggestions(tagInput.key),
    enabled: false,
    onSuccess: (data) => {
      setTagSuggestions(data);
      setShowSuggestions(true);
    }
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

  const handleTagInputChange = (field, value) => {
    setTagInput(prev => ({ ...prev, [field]: value }));
    
    // Fetch suggestions when typing in key field
    if (field === 'key' && value.trim()) {
      setTimeout(() => fetchSuggestions(), 300);
    } else if (field === 'key' && !value.trim()) {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion) => {
    setTagInput(suggestion);
    setShowSuggestions(false);
  };

  const addTag = () => {
    if (!tagInput.key.trim()) return;
    
    // Check for duplicates
    const isDuplicate = tags.some(tag => 
      tag.key === tagInput.key.trim() && tag.value === tagInput.value.trim()
    );
    
    if (!isDuplicate) {
      setTags(prev => [...prev, { 
        key: tagInput.key.trim(), 
        value: tagInput.value.trim() 
      }]);
    }
    
    setTagInput({ key: '', value: '' });
    setShowSuggestions(false);
  };

  const removeTag = (index) => {
    setTags(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">Create Document</h2>
            
            {mutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {mutation.error?.response?.data?.message || 
                 Object.values(mutation.error?.response?.data || {}).flat().join(', ') ||
                 mutation.error?.message || 
                 'Failed to create document. Please try again.'}
              </div>
            )}
            
            <Formik
              initialValues={{
                title: '',
                description: '',
                content: '',
                file: null,
                status: 'draft'
              }}
              validationSchema={DocumentCreateSchema}
              onSubmit={(values, { setSubmitting }) => {
                const formData = {
                  ...values,
                  tags_data: tags
                };
                mutation.mutate(formData, { onSettled: () => setSubmitting(false) });
              }}
            >
              {({ isSubmitting, setFieldValue, values }) => (
                <Form className="space-y-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                      Document Title *
                    </label>
                    <Field
                      type="text"
                      name="title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter document title (max 100 characters)"
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
                      placeholder="Enter a brief description"
                    />
                    <ErrorMessage name="description" component="div" className="text-red-600 text-sm mt-1" />
                  </div>

                  <div>
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                      Content {!values.file && '*'}
                    </label>
                    <Field
                      as="textarea"
                      name="content"
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter document content (required if no file is uploaded)"
                    />
                    <p className="text-gray-500 text-sm mt-1">
                      {values.file ? 'Content is optional when a file is provided' : 'Content is required if no file is uploaded'}
                    </p>
                    <ErrorMessage name="content" component="div" className="text-red-600 text-sm mt-1" />
                  </div>

                  <div>
                    <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                      Upload File {!values.content?.trim() && '*'}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(event) => {
                        const file = event.currentTarget.files[0];
                        setFieldValue('file', file);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-gray-500 text-sm mt-1">
                      Supported formats: PDF, DOCX, TXT (max 10MB)
                      {values.content?.trim() ? ' - Optional when content is provided' : ' - Required if no content is entered'}
                    </p>
                    <ErrorMessage name="file" component="div" className="text-red-600 text-sm mt-1" />
                  </div>

                  {/* Tags Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (Optional)
                    </label>
                    
                    {/* Add Tag Form */}
                    <div className="border border-gray-300 rounded-md p-4 mb-3">
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1 relative">
                          <input
                            ref={tagInputRef}
                            type="text"
                            placeholder="Tag key (required)"
                            value={tagInput.key}
                            onChange={(e) => handleTagInputChange('key', e.target.value)}
                            onKeyPress={handleKeyPress}
                            onFocus={() => tagInput.key.trim() && setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            maxLength={50}
                          />
                          
                          {/* Suggestions Dropdown */}
                          {showSuggestions && tagSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {tagSuggestions.map((suggestion, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => selectSuggestion(suggestion)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                                >
                                  <span className="font-medium">{suggestion.key}</span>
                                  {suggestion.value && <span className="text-gray-600">: {suggestion.value}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <input
                          type="text"
                          placeholder="Tag value (optional)"
                          value={tagInput.value}
                          onChange={(e) => handleTagInputChange('value', e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          maxLength={100}
                        />
                        
                        <button
                          type="button"
                          onClick={addTag}
                          disabled={!tagInput.key.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Add
                        </button>
                      </div>
                      
                      <p className="text-gray-500 text-xs">
                        Key is required, value is optional. Press Enter or click Add to add the tag.
                      </p>
                    </div>
                    
                    {/* Display Added Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                          >
                            <span className="font-medium">{tag.key}</span>
                            {tag.value && <span>: {tag.value}</span>}
                            <button
                              type="button"
                              onClick={() => removeTag(index)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
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
                          Creating...
                        </>
                      ) : (
                        'Create Document'
                      )}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
}
