import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import { toast } from 'react-hot-toast';

export default function DocumentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('draft');
  const [tags, setTags] = useState([]);
  const [tagKeyInput, setTagKeyInput] = useState('');
  const [tagValueInput, setTagValueInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTagSuggestions, setFilteredTagSuggestions] = useState([]);

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
      setTags(document.tags ? document.tags.map(tag => ({ key: tag.key, value: tag.value })) : []);
    }
  }, [document]);

  // Update handleAddTag to prevent duplicates and use existing tags if available
  const handleAddTag = () => {
    try {
      const safeAvailableTags = Array.isArray(availableTags) ? availableTags : [];
      if (!Array.isArray(availableTags)) {
        toast.error('Tags are still loading. Please try again in a moment.');
        return;
      }
      
      const key = tagKeyInput.trim();
      const value = tagValueInput.trim();
      if (!key || !value) {
        toast.error('Please enter both a tag key and value.');
        return;
      }
      
      // Check if tag already exists in availableTags or tags
      const existingTag = safeAvailableTags.find(
        t => t.key === key && t.value === value
      ) || tags.find(t => t.key === key && t.value === value);
      
      if (existingTag) {
        // If already in tags, show toast
        if (tags.some(t => t.key === key && t.value === value)) {
          toast.error('Tag already added.');
          return;
        }
        // Add existing tag to tags state
        setTags([...tags, existingTag]);
        setTagKeyInput('');
        setTagValueInput('');
        toast.success('Tag added!');
        return;
      }
      
      // Add new tag (without id)
      setTags([...tags, { key, value }]);
      setTagKeyInput('');
      setTagValueInput('');
      toast.success('Tag added!');
    } catch (err) {
      toast.error('Unexpected error adding tag: ' + (err?.message || err));
    }
  };

  const handleRemoveTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (typeof handleAddTag === 'function') {
        handleAddTag();
      } else {
        toast.error('Add Tag function not available.');
      }
    }
  };

  const handleSaveMetadata = async () => {
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
      
      // 6. Update document with all tag IDs - this will sync to S3 automatically via backend
      await documentsAPI.updateDocument(id, {
        title,
        description,
        content,
        status,
        tag_ids: allTagIds,
      });
      
      setIsSaving(false);
      toast.success('Document metadata updated successfully! Tags have been synced to AWS S3.');
      queryClient.invalidateQueries({ queryKey: ['document', id] });
    } catch (err) {
      setIsSaving(false);
      toast.error('Failed to update document metadata.');
    }
  };

  // Filter tag suggestions as user types
  useEffect(() => {
    if (tagKeyInput.trim().length === 0) {
      setFilteredTagSuggestions([]);
      setShowTagSuggestions(false);
      return;
    }
    const input = tagKeyInput.trim().toLowerCase();
    const suggestions = availableTags.filter(
      t =>
        (t.key.toLowerCase().includes(input) || t.value.toLowerCase().includes(input)) &&
        !tags.some(tag => tag.key === t.key && tag.value === t.value)
    );
    setFilteredTagSuggestions(suggestions);
    setShowTagSuggestions(suggestions.length > 0);
  }, [tagKeyInput, availableTags, tags]);

  // When a suggestion is clicked
  const handleTagSuggestionClick = (tag) => {
    // If already in tags, do nothing
    if (tags.some(t => t.key === tag.key && t.value === tag.value)) {
      toast.error('Tag already added.');
      setShowTagSuggestions(false);
      return;
    }
    setTags([...tags, tag]);
    setTagKeyInput('');
    setTagValueInput('');
    setShowTagSuggestions(false);
    toast.success('Tag added!');
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
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <h1 className="text-2xl font-bold text-slate-900">Edit Document</h1>
            </div>
            <Link 
              to={`/documents/${id}`}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Document
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Title & Description */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Document Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter document title"
                    maxLength={100}
                  />
                  <p className="text-xs text-slate-500 mt-1">{title.length}/100 characters</p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Enter document description"
                    rows="3"
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-500 mt-1">{description.length}/500 characters</p>
                </div>

                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-slate-700 mb-2">
                    Content
                  </label>
                  <textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Enter document content"
                    rows="10"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tags Section */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Tags
              </h3>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={tagKeyInput}
                      onChange={(e) => setTagKeyInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Tag key (e.g., category)"
                    />
                    {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredTagSuggestions.map((tag) => (
                          <button
                            key={`${tag.key}-${tag.value}`}
                            onClick={() => handleTagSuggestionClick(tag)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-center gap-2"
                          >
                            <span className="font-medium text-sm">{tag.key}</span>
                            <span className="text-xs text-slate-500">→</span>
                            <span className="text-sm text-slate-700">{tag.value}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={tagValueInput}
                    onChange={(e) => setTagValueInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Tag value (e.g., report)"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm hover:shadow flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium border border-blue-200"
                      >
                        <span className="font-semibold">{tag.key}:</span>
                        <span>{tag.value}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(index)}
                          className="ml-1 text-blue-600 hover:text-blue-800 transition-colors"
                          aria-label="Remove tag"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-md">
              <div className="flex justify-end">
                <button
                  onClick={handleSaveMetadata}
                  disabled={isSaving || !title.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium shadow-sm hover:shadow flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Additional features can be added here in the future */}
          </div>
        </div>
      </div>
    </div>
  );
}
