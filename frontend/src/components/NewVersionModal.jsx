import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import { Upload, X, Tag, Plus } from 'lucide-react';

const NewVersionModal = ({ document, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [inheritMetadata, setInheritMetadata] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    changes_description: '',
    reason: ''
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Get current document metadata
  const { data: currentMetadata } = useQuery({
    queryKey: ['document-metadata', document?.id],
    queryFn: () => documentsAPI.getDocumentMetadata(document.id),
    enabled: !!document?.id && isOpen
  });

  // Get available tags
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsAPI.getTags,
    enabled: isOpen
  });

  const createVersionMutation = useMutation({
    mutationFn: (data) => documentsAPI.createDocumentVersion(document.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-versions', document.id] });
      onClose();
      resetForm();
    },
    onError: (error) => {
      console.error('Version creation error:', error);
      alert('Failed to create new version. Please try again.');
    }
  });

  useEffect(() => {
    if (currentMetadata && inheritMetadata) {
      setFormData(prev => ({
        ...prev,
        title: currentMetadata.title || '',
        description: currentMetadata.description || ''
      }));
      setSelectedTags(currentMetadata.tags || []);
    }
  }, [currentMetadata, inheritMetadata]);

  const resetForm = () => {
    setFile(null);
    setInheritMetadata(true);
    setFormData({
      title: '',
      description: '',
      changes_description: '',
      reason: ''
    });
    setSelectedTags([]);
    setTagSearchQuery('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!file) {
      alert('Please select a file to upload.');
      return;
    }

    const submitData = new FormData();
    submitData.append('file', file);
    submitData.append('inherit_metadata', inheritMetadata);
    
    if (!inheritMetadata) {
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('tag_ids', JSON.stringify(selectedTags.map(tag => tag.id)));
    }
    
    submitData.append('changes_description', formData.changes_description);
    submitData.append('reason', formData.reason);

    createVersionMutation.mutate(submitData);
  };

  const handleTagSelect = (tag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagSearchQuery('');
  };

  const handleTagRemove = (tagId) => {
    setSelectedTags(selectedTags.filter(t => t.id !== tagId));
  };

  const filteredTags = tagsData?.results?.filter(tag =>
    tag.display_name.toLowerCase().includes(tagSearchQuery.toLowerCase()) &&
    !selectedTags.find(t => t.id === tag.id)
  ) || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Upload New Version</h2>
            <p className="text-sm text-gray-600 mt-1">{document?.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="file-input"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <Upload size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {file ? file.name : 'Click to select a file or drag and drop'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, DOCX, TXT, PNG, JPG, JPEG up to 10MB
                </p>
              </label>
            </div>
          </div>

          {/* Metadata Inheritance */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="inherit-metadata"
                checked={inheritMetadata}
                onChange={(e) => setInheritMetadata(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="inherit-metadata" className="text-sm font-medium text-gray-700">
                Use existing document metadata (title, description, tags)
              </label>
            </div>
          </div>

          {/* Custom Metadata (when not inheriting) */}
          {!inheritMetadata && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required={!inheritMetadata}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                
                {/* Selected Tags */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                      >
                        {tag.display_name}
                        <button
                          type="button"
                          onClick={() => handleTagRemove(tag.id)}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="Search for tags..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  
                  {/* Tag Suggestions */}
                  {tagSearchQuery && filteredTags.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleTagSelect(tag)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Tag size={14} style={{ color: tag.color }} />
                          {tag.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Version Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Changes Description
              </label>
              <textarea
                value={formData.changes_description}
                onChange={(e) => setFormData({...formData, changes_description: e.target.value})}
                rows={3}
                placeholder="Describe what changed in this version..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Update
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Brief reason for this update..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={createVersionMutation.isLoading || !file}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createVersionMutation.isLoading ? 'Uploading...' : 'Upload Version'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewVersionModal;
