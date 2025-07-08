import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, tagsAPI } from '../services/api';
import { useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.jsx';
import { usersAPI } from '../services/api';
import DateRangePicker from '../components/DateRangePicker.jsx';
// import { useRef, useState } from 'react';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function DocumentListPage() {

  // Initialize hooks

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    file_type: '',
    created_by: '',
    created_date_from: '',
    created_date_to: '',
    tags: []
  });
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: usersAPI.getUsers,
  });
  const [searchInput, setSearchInput] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showMode, setShowMode] = useState('all'); // 'all' or 'mine'
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [dateRangePopoverOpen, setDateRangePopoverOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
  const dateRangeButtonRef = useRef();
  const dateRangePopoverRef = useRef();
  const justOpenedRef = useRef(false);

  useEffect(() => {
    if (!dateRangePopoverOpen) return;
    function handleClickOutside(event) {
      if (justOpenedRef.current) {
        justOpenedRef.current = false;
        return;
      }
      if (
        dateRangePopoverRef.current &&
        !dateRangePopoverRef.current.contains(event.target) &&
        dateRangeButtonRef.current &&
        !dateRangeButtonRef.current.contains(event.target)
      ) {
        setDateRangePopoverOpen(false);
      }
    }
    // Attach after a short delay to avoid catching the opening click
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dateRangePopoverOpen]);

  // Remove useQuery for documents, only use localStorage for caching and filtering
  // const { data: documentsData, isLoading: documentsDataumentsLoading, error } = useQuery({
  //   queryKey: ['documentsDatauments', filters],
  //   queryFn: () => documentsDataumentsAPI.getdocumentsDatauments(getApiFilters()),
  //   keepPreviousData: true,
  // });

  // Remove all usages of documentsData and documentsDataumentsLoading, error for documents
  // Use local state for loading
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState(null);

  // Fetch all documents once and cache in localStorage
  useEffect(() => {
    setDocumentsLoading(true);
    documentsAPI.getDocuments({})
      .then(data => {
        localStorage.setItem('allDocuments', JSON.stringify(data.results || []));
        setDocumentsLoading(false);
      })
      .catch(err => {
        setDocumentsError('Failed to load documents. Please try again.');
        setDocumentsLoading(false);
      });
  }, []);

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 500);

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('user');
      if (user) {
        setCurrentUser(JSON.parse(user));
      }
    }
  }, []);

  // // Prepare filters for API (remove empty values and ensure date format)
  // const getApiFilters = () => {
  //   const apiFilters = { ...filters };
  //   // Remove empty filters
  //   Object.keys(apiFilters).forEach((key) => {
  //     if (apiFilters[key] === '' || apiFilters[key] == null || (Array.isArray(apiFilters[key]) && apiFilters[key].length === 0)) {
  //       delete apiFilters[key];
  //     }
  //   });
  //   // Ensure date format is YYYY-MM-DD
  //   if (apiFilters.created_date_from) {
  //     apiFilters.created_date_from = apiFilters.created_date_from.slice(0, 10);
  //   }
  //   if (apiFilters.created_date_to) {
  //     apiFilters.created_date_to = apiFilters.created_date_to.slice(0, 10);
  //   }
  //   return apiFilters;
  // };

  // Derive available tags from active documents cache (excludes trashed docs)
  let tagsArray = [];
  try {
    const allDocs = JSON.parse(localStorage.getItem('allDocuments') || '[]');
    const tagMap = new Map();
    allDocs.forEach((doc) => {
      (doc.tags || []).forEach((tag) => {
        if (!tagMap.has(tag.id)) tagMap.set(tag.id, tag);
      });
    });
    tagsArray = Array.from(tagMap.values());
  } catch (e) {
    tagsArray = [];
  }

  // console.log('Available Tags:', availableTags);
  // console.log('Current User:', currentUser);

  // console.log('Available Tags:', availableTags);
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: documentsAPI.deleteDocument,
    onSuccess: (_, deletedId) => {
      // Remove the deleted document from localStorage cache
      const docs = getAllDocumentsFromCache();
      const updatedDocs = docs.filter(doc => doc.id !== deletedId);
      localStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
      queryClient.invalidateQueries({ queryKey: ['documentsDatauments'] });
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      alert('Failed to delete document. Please try again.');
    },
  });

  // Check authentication and redirect if necessary
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/signin');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Helper to get all documents from cache
  const getAllDocumentsFromCache = () => {
    try {
      const docs = localStorage.getItem('allDocuments');
      return docs ? JSON.parse(docs) : [];
    } catch {
      return [];
    }
  };

  // Use cached documents for filtering
  const getFilteredDocuments = () => {
    if (!currentUser) return [];
    const allDocs = getAllDocumentsFromCache();
    return allDocs.filter(doc => {
      // 1. ShowMode filter
      if (showMode === 'mine' && doc.created_by?.username !== currentUser.username) {
        return false;
      }
      // In 'all' mode, don't filter out documents by the current user if a specific user is selected
      if (showMode === 'all' && !filters.created_by && doc.created_by?.username === currentUser.username) {
        return false;
      }

      // 2. Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        if (
          !doc.title?.toLowerCase().includes(searchTerm) &&
          !doc.description?.toLowerCase().includes(searchTerm)
        ) {
          return false;
        }
      }

      // 3. Created By filter (only apply in 'all' mode)
      if (showMode === 'all' && filters.created_by && filters.created_by !== '') {
        // Find the selected user object from the dropdown by ID
        const selectedUser = usersData?.results.find(u => String(u.id) === String(filters.created_by));
        if (!selectedUser) return false;
        // Defensive: ensure doc.created_by and doc.created_by.id exist
        if (!doc.created_by || doc.created_by.id == null) {
          return false;
        }
        // Compare document's created_by.id to selected user's id
        if (String(doc.created_by.id) !== String(selectedUser.id)) {
          return false;
        }
      }

      // 4. Status filter
      if (filters.status && doc.status !== filters.status) {
        return false;
      }

      // 5. Date range filters
      if (dateRange.from && new Date(doc.created_at) < new Date(dateRange.from)) {
        return false;
      }
      if (dateRange.to && new Date(doc.created_at) > new Date(dateRange.to)) {
        return false;
      }

      // 6. Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const tagIds = doc.tags?.map(tag => tag.id) || [];
        const hasAllTags = filters.tags.every(tagId => tagIds.includes(tagId));
        if (!hasAllTags) return false;
      }

      return true;
    });
  };


  const filteredDocuments = getFilteredDocuments();

  // Modified to include all users except current user, regardless of whether they've created documents
  const usersDropdown = (usersData?.results || []).filter(u => !currentUser || String(u.id) !== String(currentUser.id));

  // tagsArray now contains unique tags from non-deleted documents

  // Use users from backend only for the dropdown, excluding the current user
  // const usersDropdown = (usersData?.results || []).filter(u => !currentUser || u.id !== currentUser.id);

  const handleDeleteClick = (doc) => {
    setDocumentToDelete(doc);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (documentToDelete) {
      deleteMutation.mutate(documentToDelete.id);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "" ? "" : value
    }));
  };


  const handleTagSelect = (tag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      setFilters(prev => ({ ...prev, tags: newTags.map(t => t.id) }));
    }
  };

  const handleTagRemove = (tagId) => {
    const newTags = selectedTags.filter(t => t.id !== tagId);
    setSelectedTags(newTags);
    setFilters(prev => ({ ...prev, tags: newTags.map(t => t.id) }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      file_type: '',
      created_by: '',
      created_date_from: '',
      created_date_to: '',
      tags: []
    });
    setSearchInput('');
    setSelectedTags([]);
    setSelectedRange({ start: null, end: null }); // clear the date range picker UI
    setDateRange({ from: null, to: null });      // clear the date range used for filtering
  };

  // Update filters when toggling All/My documents
  const handleShowAll = () => {
    setShowMode('all');
    // Clear the created_by filter when switching to all documents
    setFilters(prev => ({ ...prev, created_by: '' }));
  };

  const handleShowMine = () => {
    if (currentUser) {
      setShowMode('mine');
      // Clear the created_by filter when switching to my documents (not applicable in mine mode)
      setFilters(prev => ({ ...prev, created_by: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage and organize your documents</p>
          </div>
          <button
            onClick={() => navigate('/documents/create')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Document
          </button>
        </div>



        {/* Search and Filters */}
        <div className="bg-white mb-5 rounded-xl shadow border-t-4 border-blue-600 p-6 space-y-6">
          {/* Main Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[400px] max-w-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm w-full"
                placeholder="Search by title, keyword, etc."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>

            {/* Created By */}
            {showMode === 'all' && (
              <div className="min-w-[140px] flex-1 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                <select
                  value={filters.created_by}
                  onChange={(e) => handleFilterChange('created_by', e.target.value)}
                  className="w-full appearance-none px-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  <option value="">All Users</option>
                  {usersDropdown.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.first_name || user.last_name
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : user.email || user.username || `User ${user.id}`}
                    </option>
                  ))}
                </select>

                {/* Custom dropdown arrow */}
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-end top-1/3">
                  <svg
                    className="w-3 h-3 text-gray-400"
                    fill="none"
                    stroke="black"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}


            {/* Status */}
            <div className="relative min-w-[120px] flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>

              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full appearance-none px-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              {/* Custom dropdown arrow */}
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-end top-1/3">
                <svg
                  className="h-3 w-3 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="black" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

            </div>


            {/* Date Range */}
            <div className="relative min-w-[255px] flex-1">
              <label className=" text-sm font-medium text-gray-700 mb-1">Created Date Range</label>
              <button
                ref={dateRangeButtonRef}
                type="button"
                className="w-full px-3 py-2 border flex justify-between items-center   border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left text-sm"
                onClick={e => {
                  justOpenedRef.current = true;
                  setDateRangePopoverOpen(true);
                }}
              >
                {selectedRange.start && selectedRange.end
                  ? `${selectedRange.start.toLocaleDateString()} - ${selectedRange.end.toLocaleDateString()}`
                  : 'Select date range'}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
              </button>
              {dateRangePopoverOpen && (
                <div
                  ref={dateRangePopoverRef}
                  className="absolute z-50 mt-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg"
                  style={{ minWidth: '220px' }}
                >
                  <DateRangePicker
                    value={selectedRange}
                    popoverOpen={dateRangePopoverOpen}
                    onRangeSelected={(range) => {
                      setSelectedRange(range);
                      setDateRange({ from: range.start, to: range.end });
                      setDateRangePopoverOpen(false);
                      setFilters((prev) => ({
                        ...prev,
                        created_date_from: range.start?.toISOString().slice(0, 10) || '',
                        created_date_to: range.end?.toISOString().slice(0, 10) || '',
                      }));
                    }}
                    onClose={() => setDateRangePopoverOpen(false)}
                  />

                </div>
              )}

            </div>
            {/* Clear All */}
            <div className="min-w-[120px] flex items-end justify-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 border border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 rounded-lg text-sm transition"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          {/* Tag Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Tags</label>
            <div className="flex flex-wrap gap-2">
              {tagsArray.length > 0 ? (
                tagsArray
                  .filter((tag) => {
                    if (!currentUser || !tag.created_by) return false;
                    const tagOwner = tag.created_by;
                    return showMode === 'mine'
                      ? tagOwner.email === currentUser.email
                      : showMode === 'all'
                        ? tagOwner.email !== currentUser.email
                        : true;
                  })
                  .map((tag) => {
                    const isSelected = selectedTags.some((t) => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagSelect(tag)}
                        disabled={isSelected}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${isSelected
                          ? 'bg-blue-100 text-blue-700 border-blue-300 cursor-not-allowed'
                          : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
                          }`}
                      >
                        {tag.display_name || (tag.value ? `${tag.key}: ${tag.value}` : tag.key)}
                      </button>
                    );
                  })
              ) : (
                <span className="text-gray-400 text-xs">No tags available</span>
              )}
            </div>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                  >
                    {tag.display_name || (tag.value ? `${tag.key}: ${tag.value}` : tag.key)}
                    <button
                      onClick={() => handleTagRemove(tag.id)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>


        </div>

        {/* All/My documents Toggle Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${showMode === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            onClick={handleShowAll}
          >
            All documents ({getAllDocumentsFromCache().filter(doc => doc.created_by && doc.created_by.username !== currentUser?.username).length})
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${showMode === 'mine' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            onClick={handleShowMine}
            disabled={!currentUser}
          >
            My documents ({getAllDocumentsFromCache().filter(doc => doc.created_by && doc.created_by.username === currentUser?.username).length})
          </button>
        </div>
        {/* Results */}
        {documentsLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : documentsError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {documentsError}
          </div>) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5 min-w-0">
                      Document
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Tags
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Owner
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Created
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Version
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      {/* Document Title - Combined with description and mobile info */}
                      <td className="px-4 py-4 min-w-0">
                        <div className="flex flex-col">
                          <button
                            onClick={() => navigate(`/documents/${doc.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium focus:outline-none text-left truncate"
                            title={doc.title}
                          >
                            {doc.title}
                          </button>
                          {doc.description && (
                            <p className="text-sm text-gray-500 mt-1 truncate" title={doc.description}>
                              {doc.description.length > 60 ? `${doc.description.substring(0, 60)}...` : doc.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 mt-1 md:hidden">
                            <span className="text-xs text-gray-400">v{doc.version || '1.0'}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </td>
                      {/* Tags - Hidden on mobile, limited to 2 tags */}
                      <td className="px-3 py-4 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {doc.tags && doc.tags.length > 0 ? (
                            doc.tags.slice(0, 2).map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                              >
                                {tag.display_name || (tag.value ? `${tag.key}: ${tag.value}` : tag.key)}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                          {doc.tags && doc.tags.length > 2 && (
                            <span className="text-xs text-gray-500">+{doc.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      {/* Owner - Hidden on tablet and mobile, shows full name or email */}
                      <td className="px-3 py-4 hidden lg:table-cell text-sm text-gray-900 truncate">
                        {doc.created_by?.first_name && doc.created_by?.last_name
                          ? `${doc.created_by.first_name} ${doc.created_by.last_name}`
                          : doc.created_by?.email?.split('@')[0] || 'Unknown'}
                      </td>
                      {/* Created At - Hidden on mobile */}
                      <td className="px-3 py-4 hidden sm:table-cell text-sm text-gray-900">
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </td>

                      {/* Version - Hidden on mobile and small tablets */}
                      <td className="px-3 py-4 hidden md:table-cell text-sm text-gray-900">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          v{doc.version || '1.0'}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${doc.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : doc.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      {/* Actions */}
                      {currentUser && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-1">
                            {/* View Button - Visible to all */}
                            <button
                              onClick={() => navigate(`/documents/${doc.id}`)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                              title="View document details"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </button>

                            {/* Check ownership before showing Edit and Delete */}
                            {doc.created_by && currentUser && doc.created_by.id === currentUser.id && (
                              <>
                                {/* Edit Button */}
                                <button
                                  onClick={() => navigate(`/documents/${doc.id}/edit`)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
                                  title="Edit document"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>

                                {/* Archive Button */}
                                <button
                                  onClick={async () => {
                                    await documentsAPI.archiveDocument(doc.id);
                                    // Remove from local cache
                                    const docs = getAllDocumentsFromCache();
                                    const updatedDocs = docs.filter(d => d.id !== doc.id);
                                    localStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
                                    // Optionally, trigger a re-render
                                    setFilters(f => ({ ...f }));
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-300 hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                  title="Archive"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                  </svg>
                                </button>

                                {/* Delete Button */}
                                <button
                                  onClick={() => handleDeleteClick(doc)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                  title="Delete document"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* No documents Found Alert */}
            {filteredDocuments.length === 0 && (
              <div className="text-center py-16">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No documents found</h3>
                <p className="mt-2 text-gray-500">
                  {filters.search || filters.status || filters.created_by || selectedTags.length > 0
                    ? "Try adjusting your search criteria or filters to find what you're looking for."
                    : "Get started by uploading your first document."
                  }
                </p>
                <div className="mt-6">
                  {filters.search || filters.status || filters.created_by || selectedTags.length > 0 ? (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Clear all filters
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/documents/create')}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload your first document
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700">
                  Are you sure you want to delete "{documentToDelete?.title}"? This action cannot be undone.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-md transition-colors"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
