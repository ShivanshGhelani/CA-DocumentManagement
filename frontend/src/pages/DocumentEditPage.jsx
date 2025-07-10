import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import NewVersionModal from '../components/NewVersionModal';

export default function DocumentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tagInputRef = useRef(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('draft');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState({ key: '', value: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTagSuggestions, setFilteredTagSuggestions] = useState([]);
  const [originalTags, setOriginalTags] = useState([]);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);

  // Fetch document data
  const { data: document, isLoading: documentLoading, error: documentError } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsAPI.getDocument(id),
  });

  // Fetch available tags
  const { data: availableTagsRaw } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsAPI.getTags,
  });
  
  // Always use an array for availableTags
  const availableTags = Array.isArray(availableTagsRaw)
    ? availableTagsRaw
    : (availableTagsRaw?.results || []);

  // Set initial values when document loads
  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      setDescription(document.description || '');
      setContent(document.content || '');
      setStatus(document.status || 'draft');
      const documentTags = document.tags ? document.tags.map(tag => ({ 
        id: tag.id, 
        key: tag.key, 
        value: tag.value 
      })) : [];
      setTags(documentTags);
      setOriginalTags(documentTags);
    }
  }, [document]);

  // Filter tag suggestions as user types
  useEffect(() => {
    if (tagInput.key.trim().length === 0) {
      setFilteredTagSuggestions([]);
      setShowTagSuggestions(false);
      return;
    }
    const input = tagInput.key.trim().toLowerCase();
    const suggestions = availableTags.filter(
      t =>
        (t.key.toLowerCase().includes(input) || t.value.toLowerCase().includes(input)) &&
        !tags.some(tag => tag.key === t.key && tag.value === t.value)
    );
    setFilteredTagSuggestions(suggestions);
    setShowTagSuggestions(suggestions.length > 0);
  }, [tagInput.key, availableTags, tags]);

  // When a suggestion is clicked
  const handleTagSuggestionClick = (tag) => {
    if (tags.some(t => t.key === tag.key && t.value === tag.value)) {
      setShowTagSuggestions(false);
      return;
    }
    setTags([...tags, tag]);
    setTagInput({ key: '', value: '' });
    setShowTagSuggestions(false);
    toast.success('Tag added!');
  };

  // Add tag (manual entry)
  const addTag = () => {
    if (!tagInput.key.trim()) {
      toast.error('Tag key is required');
      return;
    }
    const isDuplicate = tags.some(tag => 
      tag.key === tagInput.key.trim() && tag.value === tagInput.value.trim()
    );
    if (isDuplicate) {
      toast.error('Tag already exists');
      return;
    }
    setTags(prev => [...prev, { 
      key: tagInput.key.trim(), 
      value: tagInput.value.trim() 
    }]);
    setTagInput({ key: '', value: '' });
    setShowTagSuggestions(false);
    toast.success('Tag added!');
  };

  // Remove tag by index
  const removeTag = (index) => {
    setTags(tags => tags.filter((_, i) => i !== index));
    toast.success('Tag removed!');
  };

  const handleTagInputChange = (field, value) => {
    setTagInput(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // Check if tags have changed
  const tagsChanged = () => {
    if (originalTags.length !== tags.length) return true;
    return !originalTags.every(originalTag => 
      tags.some(tag => tag.key === originalTag.key && tag.value === originalTag.value)
    );
  };

  const handleSaveMetadata = async () => {
    if (!title.trim()) {
      toast.error('Document title is required');
      return;
    }
    setIsSaving(true);
    try {
      // 1. For tags without id, check if they exist in availableTags (by key/value)
      const tagsWithIds = tags.map(tag => {
        if (tag.id) return tag;
        const found = (availableTags || []).find(t => t.key === tag.key && t.value === tag.value);
        return found ? found : tag;
      });
      // 2. Create only tags that still have no id
      const newTagsToCreate = tagsWithIds.filter(tag => !tag.id);
      const createdTagObjs = [];
      for (const tag of newTagsToCreate) {
        try {
          const created = await tagsAPI.createTag({ key: tag.key, value: tag.value });
          createdTagObjs.push(created);
        } catch (err) {
          toast.error(`Failed to create tag: ${tag.key}`);
        }
      }
      // 3. Merge all tags (existing, found, and newly created)
      const allTags = [
        ...tagsWithIds.filter(tag => tag.id),
        ...createdTagObjs,
      ];
      // 4. Remove duplicates (by id or key/value)
      const uniqueTags = [];
      const seen = new Set();
      for (const tag of allTags) {
        const tagKey = tag.id ? `id:${tag.id}` : `kv:${tag.key}:${tag.value}`;
        if (!seen.has(tagKey)) {
          uniqueTags.push(tag);
          seen.add(tagKey);
        }
      }
      setTags(uniqueTags); // update state for UI
      // 5. Collect all tag IDs
      const allTagIds = uniqueTags.map(tag => tag.id).filter(Boolean);
      // 6. Always update document to force backend S3 sync, even if only tags changed
      await documentsAPI.updateDocument(id, {
        title,
        description,
        content,
        status,
        tag_ids: allTagIds,
        force_s3_tag_sync: true, // backend should respect this for forced S3 sync
      });
      setIsSaving(false);
      toast.success('Document updated and tags synced to AWS S3!');
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      setOriginalTags(uniqueTags);
    } catch (err) {
      setIsSaving(false);
      toast.error('Failed to update document metadata.');
      console.error('Save error:', err);
    }
  };

  if (documentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (documentError || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to load document</h3>
          <p className="text-gray-600 mb-4">We couldn't retrieve the document. Please try again or check your permissions.</p>
          <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => navigate('/documents')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Back to Documents
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-blue-600">Edit Document</h2>
              <Link 
                to={`/documents/${id}`}
                className="text-gray-600 hover:text-gray-900 flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Document
              </Link>
            </div>
            
            {/* Upload New Version Button */}
            <button
              onClick={() => setShowNewVersionModal(true)}
              className="w-full flex items-center justify-between p-4 bg-green-50/70 hover:bg-green-100/70 rounded-xl transition-all text-left text-green-700 group border border-green-200/50 hover:shadow-md mb-6"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="font-semibold">Upload New Version</span>
              </div>
              <svg className="w-4 h-4 text-green-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {/* NewVersionModal */}
            {showNewVersionModal && (
              <NewVersionModal
                document={document}
                isOpen={showNewVersionModal}
                onClose={() => setShowNewVersionModal(false)}
              />
            )}
            
            {/* Document Information Section */}
            <div className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Document Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter document title (max 100 characters)"
                  maxLength={100}
                />
                <p className="text-gray-500 text-sm mt-1">{title.length}/100 characters</p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter a brief description"
                  maxLength={500}
                />
                <p className="text-gray-500 text-sm mt-1">{description.length}/500 characters</p>
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter document content"
                />
                <p className="text-gray-500 text-sm mt-1">
                  Update the document content. This will only change the metadata, not the uploaded file.
                </p>
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
                        onChange={e => handleTagInputChange('key', e.target.value)}
                        onKeyPress={handleKeyPress}
                        onFocus={() => setShowTagSuggestions(filteredTagSuggestions.length > 0)}
                        onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        maxLength={50}
                      />
                      {/* Suggestions Dropdown */}
                      {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredTagSuggestions.map((tag, idx) => (
                            <div
                              key={tag.id || tag.key + tag.value + idx}
                              className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-slate-700 flex justify-between items-center"
                              onMouseDown={() => handleTagSuggestionClick(tag)}
                            >
                              <span><b>{tag.key}</b>{tag.value ? `: ${tag.value}` : ''}</span>
                            </div>
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
                    Key is required, value is optional. Press Enter or click Add to add the tag. Changes will sync to AWS S3.
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
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => navigate(`/documents/${id}`)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMetadata}
                  disabled={isSaving || !title.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md transition-colors"
                >
                  {isSaving ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
