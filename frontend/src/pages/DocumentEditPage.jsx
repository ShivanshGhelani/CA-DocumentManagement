import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import apiClient from '../services/axios';

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
  const queryClient = useQueryClient();
  const [selectedTags, setSelectedTags] = useState([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = React.useRef(null);

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

  // Fetch document versions
  const { data: versions } = useQuery({
    queryKey: ['document-versions', id],
    queryFn: () => documentsAPI.getDocumentVersions(id),
    enabled: showVersionHistory
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

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file to upload');
      return;
    }

    // Check file size (10MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit');
      return;
    }

    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setUploadError('File type not supported. Please upload PDF, DOC, DOCX, TXT, or MD files.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      await apiClient.post(`/documents/${id}/upload-version/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      // Reset state and refresh document data
      setSelectedFile(null);
      setUploadProgress(0);
      setIsUploading(false);

      // Refresh document data
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['document-versions', id] });

      // Show version history after successful upload
      setShowVersionHistory(true);

    } catch (error) {
      setUploadError(error.response?.data?.message || 'Failed to upload file. Please try again.');
      setIsUploading(false);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  if (documentLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="text-slate-600 font-medium">Loading document...</p>
        </div>
      </div>
    );
  }

  if (documentError || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-red-100 p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to load document</h3>
          <p className="text-gray-600 mb-4">We couldn't retrieve the document. Please try again or check your permissions.</p>
          <button
            onClick={() => navigate('/documents')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors mr-3"
          >
            Back to Documents
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 mb-8">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => navigate('/documents')}
              className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Back to documents"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Document
              </h1>
              <p className="text-slate-600 mt-1">Update document information and metadata</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-2  gap-8">
          {/* Main Form Area */}
          <div className="lg:col-span-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
              {mutation.isError && (
                <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{mutation.error?.response?.data?.message || mutation.error?.message || 'Failed to update document. Please try again.'}</span>
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
                      <label htmlFor="title" className="flex text-sm font-medium text-slate-700 mb-2  items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Document Title
                      </label>
                      <Field
                        type="text"
                        name="title"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Enter document title"
                      />
                      <ErrorMessage name="title" component="div" className="text-red-600 text-sm mt-1" />
                    </div>

                    <div>
                      <label htmlFor="description" className=" text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        Description (Optional)
                      </label>
                      <Field
                        as="textarea"
                        name="description"
                        rows={4}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Enter document description"
                      />
                      <ErrorMessage name="description" component="div" className="text-red-600 text-sm mt-1" />
                    </div>

                    <div>
                      <label htmlFor="status" className="flex text-sm font-medium text-slate-700 mb-2  items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Status
                      </label>
                      <Field
                        as="select"
                        name="status"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </Field>
                      <ErrorMessage name="status" component="div" className="text-red-600 text-sm mt-1" />
                    </div>

                    {availableTags && availableTags.length > 0 && (
                      <div>
                        <label className=" text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          Tags (Optional)
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 rounded-lg border border-slate-200/60">
                          {availableTags.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleTagToggle(tag.id)}
                              className={`px-3 py-1.5 text-sm rounded-full border cursor-pointer transition-all duration-200 hover:shadow-sm ${selectedTags.includes(tag.id)
                                  ? 'text-white border-transparent shadow-sm'
                                  : 'bg-white/80 backdrop-blur-sm hover:bg-white'
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
                          {availableTags.length === 0 && (
                            <p className="text-slate-500 text-sm py-2">No tags available</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => navigate(`/documents/${id}`)}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || mutation.isPending}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors font-medium shadow-sm hover:shadow flex items-center justify-center"
                      >
                        {isSubmitting || mutation.isPending ? (
                          <>
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Update Document
                          </>
                        )}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>

            {/* File Upload Section */}
            

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Current File Information */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Current File
                </h3>

                <div className="space-y-4">
                  <div className="bg-slate-50/70 rounded-lg p-4 border border-slate-200/60">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-medium text-slate-900 truncate">{document.file_name}</p>
                        <p className="text-sm text-slate-500">Version {document.version}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">File Type</p>
                        <p className="font-medium text-slate-900">{document.file_type}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">File Size</p>
                        <p className="font-medium text-slate-900">{(document.file_size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Created</p>
                        <p className="font-medium text-slate-900">{new Date(document.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Modified</p>
                        <p className="font-medium text-slate-900">{new Date(document.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-600 bg-blue-50/50 p-3 rounded-lg border border-blue-100/60 flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>To change the file content, use the upload section to create a new version.</p>
                  </div>
                </div>
              </div>

              {/* Version History */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Version History
                </h3>

                <button
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  className="w-full text-left mb-3 flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-slate-700 font-medium"
                >
                  <span>Show version history</span>
                  <svg className={`w-5 h-5 text-slate-500 transition-transform ${showVersionHistory ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showVersionHistory && versions && versions.length > 0 ? (
                  <div className="space-y-3 mt-4 max-h-80 overflow-y-auto pr-2">
                    {versions.map((version, index) => (
                      <div key={version.id} className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/60 hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-slate-900">Version {version.version_number}</p>
                            <p className="text-xs text-slate-500">{new Date(version.created_at).toLocaleString()}</p>
                          </div>
                          {version.is_current && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Current</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs">
                            {version.created_by?.first_name?.[0] || 'U'}
                          </div>
                          <span className="text-slate-600">{version.created_by?.first_name} {version.created_by?.last_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : showVersionHistory ? (
                  <div className="text-center py-6 text-slate-500">
                    <p>No version history available</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-8 lg:col-span-8">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload New Version
                </h3>

                {uploadError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{uploadError}</span>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                />

                <div
                  className={`border-2 border-dashed ${selectedFile ? 'border-blue-300 bg-blue-50/30' : 'border-slate-300'} rounded-lg p-8 text-center hover:bg-slate-50/50 transition-colors cursor-pointer`}
                  onClick={triggerFileInput}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4 max-w-md mx-auto">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-slate-700 font-medium">Uploading... {uploadProgress}%</p>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-slate-700 font-medium mb-1">{selectedFile.name}</p>
                      <p className="text-slate-500 text-sm mb-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <p className="text-blue-600 text-sm font-medium mb-4">File selected - click to change</p>
                    </div>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-slate-700 font-medium mb-1">Drag and drop your file here</p>
                      <p className="text-slate-500 text-sm mb-4">or click to browse files</p>
                    </>
                  )}

                  {!isUploading && (
                    <button
                      type="button"
                      className={`px-4 py-2 ${selectedFile ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} rounded-lg transition-colors text-sm font-medium`}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectedFile ? handleFileUpload() : triggerFileInput();
                      }}
                      disabled={isUploading}
                    >
                      {selectedFile ? 'Upload File' : 'Choose File'}
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 mt-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p>Supported file types: PDF, DOC, DOCX, TXT, MD</p>
                    <p>Maximum file size: 10MB</p>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );  
}
