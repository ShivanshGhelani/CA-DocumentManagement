import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import apiClient from '../services/axios';
// import { toast } from 'react-hot-toast';

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
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [tags, setTags] = useState([]);
  const [tagKeyInput, setTagKeyInput] = useState('');
  const [tagValueInput, setTagValueInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
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
    if (document) {
      setTitle(document.title || '');
      setDescription(document.description || '');
      setStatus(document.status || 'draft');
      setTags(document.tags ? document.tags.map(tag => ({ key: tag.key, value: tag.value })) : []);
      setSelectedTags(document.tags ? document.tags.map(tag => tag.id) : []);
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

  const handleFileChange = (e) => {
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

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
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
  
  const handleAddTag = () => {
    const key = tagKeyInput.trim();
    const value = tagValueInput.trim();
    if (key && value && !tags.some(tag => tag.key === key)) {
      setTags([...tags, { key, value }]);
      setTagKeyInput('');
      setTagValueInput('');
    }
  };

  const handleRemoveTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSaveMetadata = () => {
    setIsSaving(true);
    
    // Simulate saving
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Document metadata updated successfully!');
    }, 1500);
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 shadow-sm flex items-center justify-center p-4">
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
    <div className="px-4 pt-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm shadow-sm rounded-xl  p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/documents')}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
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
            <div className="flex space-x-3">
              <button
                onClick={() => navigate(`/documents/${id}`)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Document
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Form Area - Left Column */}
          <div className="lg:col-span-1">
            {/* Document Metadata */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 transition-all duration-300 hover:shadow-md mt-">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  Document Metadata
                </h3>
                {isSaving && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Saving
                  </span>
                )}
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="document-title" className="flex text-sm font-medium text-slate-700 items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Title
                    </label>
                    <input
                      type="text"
                      id="document-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80"
                      placeholder="Document title"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="document-status" className="flex text-sm font-medium text-slate-700  items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Status
                    </label>
                    <select
                      id="document-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80"
                    >
                      <option value="draft">Draft</option>
                      <option value="review">In Review</option>
                      <option value="approved">Approved</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="document-description" className="flex text-sm font-medium text-slate-700 items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Description
                  </label>
                  <textarea
                    id="document-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80"
                    placeholder="Add a description..."
                  ></textarea>
                </div>

                <div className="space-y-2">
                  <label className="flex text-sm font-medium text-slate-700 items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[36px] p-2 bg-slate-50/70 rounded-md border border-slate-200/60">
                    {tags.length > 0 ? tags.map((tag, index) => (
                      <div key={index} className="bg-white text-slate-700 px-2 py-1 rounded-md flex items-center gap-2 shadow-sm border border-slate-200/60">
                        <span className="text-sm font-semibold">{tag.key}:</span>
                        <span className="text-sm">{tag.value}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(index)}
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label={`Remove tag ${tag.key}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )) : (
                      <span className="text-sm text-slate-400 italic">No tags added yet</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagKeyInput}
                      onChange={e => setTagKeyInput(e.target.value)}
                      className="flex-1 px-3 py-2 w-20 lg:w-20 sm:w-10 md:w-20 border border-slate-300 rounded-l-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80"
                      placeholder="Tag key..."
                    />
                    <input
                      type="text"
                      value={tagValueInput}
                      onChange={e => setTagValueInput(e.target.value)}
                      className="flex-1 px-3 py-2 w-20 border-t border-b border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80"
                      placeholder="Tag value..."
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 border-l-0 rounded-r-md hover:bg-slate-200 transition-colors font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={handleSaveMetadata}
                    disabled={isSaving}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6">
              {/* Upload New Version */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload New Version
                </h3>
                
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 transition-all ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400/50 hover:bg-slate-50/50'} ${selectedFile ? 'bg-blue-50/30' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center justify-center py-3">
                      <svg className="w-12 h-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm font-medium text-slate-700 mb-1">Drag and drop your file here</p>
                      <p className="text-xs text-slate-500 mb-3">or</p>
                      <button
                        type="button"
                        onClick={triggerFileInput}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm hover:shadow flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Select File
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.tar,.gz"
                      />
                    </div>
                  </div>

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-4">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 text-right">{uploadProgress}% uploaded</p>
                    </div>
                  )}

                  {selectedFile && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4 mt-4 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                          aria-label="Change file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleFileUpload}
                          disabled={isUploading}
                          className="p-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          aria-label="Upload file"
                        >
                          {isUploading ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4 text-sm flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 mt-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
                    <p className="font-medium text-slate-700 mb-1">Supported file types:</p>
                    <p>PDF, Word, Excel, PowerPoint, Text, CSV, ZIP, RAR, 7Z, TAR, GZ</p>
                    <p className="mt-1 font-medium text-slate-700">Maximum file size:</p>
                    <p>50MB</p>
                  </div>
                </div>

                {/* Document Information section removed to avoid duplication */}
              </div>

              {/* Version History */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Version History
                  </h3>
                  <button
                    onClick={() => setShowVersionHistory(!showVersionHistory)}
                    className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                    aria-label={showVersionHistory ? 'Hide version history' : 'Show version history'}
                  >
                    <svg className={`w-5 h-5 text-slate-500 transition-transform ${showVersionHistory ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {showVersionHistory ? (
                  versions && versions.length > 0 ? (
                    <div className="space-y-3 mt-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                      {versions.map((version, index) => (
                        <div key={version.id} className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/60 hover:shadow-sm transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">Version {version.version_number}</p>
                                <p className="text-xs text-slate-500">{new Date(version.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            {version.is_current && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full shadow-sm">Current</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-3 text-sm bg-white/80 p-2 rounded-lg border border-slate-200/60">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs shadow-sm">
                              {version.created_by?.first_name?.[0] || 'U'}
                            </div>
                            <span className="text-slate-600">{version.created_by?.first_name} {version.created_by?.last_name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50/70 rounded-lg border border-slate-200/60">
                      <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-slate-500 font-medium">No version history available</p>
                      <p className="text-slate-400 text-sm mt-1">Upload a new version to see history</p>
                    </div>
                  )
                ) : (
                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/60 flex items-start gap-2 text-sm">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-blue-700">Click the arrow to view document version history</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Upload Section moved to right column */}
        </div>
      </div>
  );  
}
