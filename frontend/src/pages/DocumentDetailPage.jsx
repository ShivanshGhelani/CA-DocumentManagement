import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/axios';
import { auditAPI } from '../services/api';
import mammoth from 'mammoth';
import VersionHistoryModal from '../components/VersionHistoryModal';
import NewVersionModal from '../components/NewVersionModal';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Global polyfill for DOMMatrix (works in both browser and server environments)
if (typeof globalThis !== 'undefined' && typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      // Minimal implementation for server-side rendering
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    multiply() { return this; }
  };
}

// Dynamically import PDF.js components to avoid SSR issues
let PDFDocument = null;
let Page = null;
let pdfjs = null;

const fetchDocument = async (id) => {
  const { data } = await apiClient.get(`/documents/${id}/`);
  return data;
};

const formatFileSize = (size) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const deleteDocument = async (id) => {
  await apiClient.delete(`/documents/${id}/`);
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const statusStyles = {
    'Published': 'bg-green-100 text-green-800 border-green-200',
    'Draft': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Archived': 'bg-gray-100 text-gray-800 border-gray-200',
    'Under Review': 'bg-blue-100 text-blue-800 border-blue-200'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status] || statusStyles['Draft']}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></div>
      {status}
    </span>
  );
};

// Modern file type SVG icons
const FileTypeSVG = ({ fileType, className = "w-8 h-8" }) => {
  switch ((fileType || '').toUpperCase()) {
    case 'PDF':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          width="100"
          height="100"
          fill="none"
        >
          <path
            d="M128 0H320L480 148.5V480C480 497.7 465.7 512 448 512H128C110.3 512 96 497.7 96 480V32C96 14.3 110.3 0 128 0Z"
            fill="#E2E5E7"
          />
          <path
            d="M320 0V128C320 136.8 327.2 144 336 144H480L320 0Z"
            fill="#B0B7BD"
          />
          <rect x="48" y="248" width="320" height="160" rx="16" fill="#F24E1E" />
          <text
            x="72"
            y="368"
            fill="white"
            fontSize="120"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="bold"
          >
            PDF
          </text>
        </svg>
      );
    case 'DOCX':
    case 'DOC':
      return (
        className = "w-16 h-16 mt-10",
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          width="100"
          height="100"
          fill="none"
        >
          <path
            d="M128 0H320L480 148.5V480C480 497.7 465.7 512 448 512H128C110.3 512 96 497.7 96 480V32C96 14.3 110.3 0 128 0Z"
            fill="#4DB3FF"
          />
          <path
            d="M320 0V128C320 136.8 327.2 144 336 144H480L320 0Z"
            fill="#1C93E3"
          />
          <rect x="48" y="248" width="400" height="160" rx="16" fill="#0066CC" />
          <text
            x="60"
            y="368"
            fill="white"
            fontSize="120"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="bold"
          >
            DOCX
          </text>
        </svg>
      );
    case 'TXT':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          width="100"
          height="100"
          fill="none"
        >
          <path
            d="M128 0H320L480 148.5V480C480 497.7 465.7 512 448 512H128C110.3 512 96 497.7 96 480V32C96 14.3 110.3 0 128 0Z"
            fill="#E2E5E7"
          />
          <path
            d="M320 0V128C320 136.8 327.2 144 336 144H480L320 0Z"
            fill="#B0B7BD"
          />
          <rect x="48" y="248" width="320" height="160" rx="16" fill="#4B5C6B" />
          <text
            x="72"
            y="368"
            fill="white"
            fontSize="120"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="bold"
          >
            TXT
          </text>
        </svg>
      );
    case 'MD':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          width="100"
          height="100"
          fill="none"
        >
          <path
            d="M128 0H320L480 148.5V480C480 497.7 465.7 512 448 512H128C110.3 512 96 497.7 96 480V32C96 14.3 110.3 0 128 0Z"
            fill="#E2E5E7"
          />
          <path
            d="M320 0V128C320 136.8 327.2 144 336 144H480L320 0Z"
            fill="#B0B7BD"
          />
          <rect x="48" y="248" width="320" height="160" rx="16" fill="#24292e" />
          <text
            x="65"
            y="368"
            fill="white"
            fontSize="110"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="bold"
          >
            MD
          </text>
        </svg>
      );
    default:
      return (
        <svg className={className + " text-gray-400"} fill="none" viewBox="0 0 48 48" stroke="currentColor">
          <rect x="6" y="6" width="36" height="36" rx="6" fill="#fff" stroke="#d1d5db" strokeWidth="2" />
          <path d="M16 32h16M16 24h16M16 16h16" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" />
          <text x="24" y="40" textAnchor="middle" fontSize="12" fill="#9ca3af" fontWeight="bold">FILE</text>
        </svg>
      );
  }
};

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentContent, setDocumentContent] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUser, setCurrentUser] = useState(null);
  const [docxHtml, setDocxHtml] = useState(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfPageWidth, setPdfPageWidth] = useState(800);
  const pdfContainerRef = useRef(null);

  // Version management state
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data } = await apiClient.get('/auth/profile/');
        setCurrentUser(data);
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  // Dynamically import PDF.js components only on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('react-pdf').then((module) => {
        PDFDocument = module.Document;
        Page = module.Page;
        pdfjs = module.pdfjs;
        // Use local worker to avoid CORS issues
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        setPdfLoaded(true);
      }).catch((error) => {
        console.error('Failed to load PDF.js:', error);
        setPdfLoaded(false);
      });
    }
  }, []);

  // Responsive PDF width logic
  useEffect(() => {
    if (!showDocumentViewer) return;
    function updateWidth() {
      if (pdfContainerRef.current) {
        const padding = 32; // 2rem padding (p-8)
        const containerWidth = pdfContainerRef.current.offsetWidth - padding;
        setPdfPageWidth(Math.max(320, Math.min(containerWidth, 900)));
      }
    }
    updateWidth();
    let resizeObserver;
    if (pdfContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(pdfContainerRef.current);
    } else {
      window.addEventListener('resize', updateWidth);
    }
    return () => {
      if (resizeObserver && pdfContainerRef.current) resizeObserver.unobserve(pdfContainerRef.current);
      window.removeEventListener('resize', updateWidth);
    };
  }, [showDocumentViewer]);

  const { data: document, isLoading, error, refetch } = useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id)
  });

  // Fetch audit logs for this document
  const { data: auditLogs } = useQuery({
    queryKey: ['document-audit', id],
    queryFn: () => auditAPI.getAuditLogs({
      resource_type: 'document',
      resource_id: id
    }),
    enabled: !!id
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      // Refresh tags list to remove tags of deleted document
      queryClient.invalidateQueries(['tags']);
      navigate('/documents');
    }
  });

  const handleDownload = () => {
    apiClient.get(`/documents/${id}/download/`).then(response => {
      window.open(response.data.download_url, '_blank');
    });
  };

  const handleViewDocument = async () => {
    try {
      const response = await apiClient.get(`/documents/${id}/download/`);
      const downloadUrl = response.data.download_url;
      if (document.file_type && ['PDF', 'pdf'].includes(document.file_type)) {
        // Open PDF in a new browser tab instead of modal
        window.open(downloadUrl, '_blank');
        return;
      } else if (document.file_type && ['DOCX', 'docx'].includes(document.file_type)) {
        // Fetch DOCX as ArrayBuffer and convert to HTML
        const docxResponse = await fetch(downloadUrl);
        const arrayBuffer = await docxResponse.arrayBuffer();
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(html);
        setDocumentContent(null);
      } else if (document.file_type && ['JPG', 'JPEG', 'PNG', 'GIF', 'jpg', 'jpeg', 'png', 'gif'].includes(document.file_type)) {
        setDocumentContent(downloadUrl);
        setDocxHtml(null);
      } else {
        const contentResponse = await fetch(downloadUrl);
        const content = await contentResponse.text();
        setDocumentContent(content);
        setDocxHtml(null);
      }
      setShowDocumentViewer(true);
    } catch (error) {
      handleDownload();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(id);
    setShowDeleteModal(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }
  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load document</h3>
          <p className="text-gray-600 mb-4">We couldn't retrieve the document. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check if the current user is the owner of the document
  const isOwner = currentUser && document && currentUser.id === document.created_by?.id;

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      content: (
        <div className="p-4">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Document Information</h2>
            {document && document.created_by ? (
              <>
                <p><strong>Title:</strong> {document.title}</p>
                <p><strong>Owner:</strong> {document.created_by.first_name} {document.created_by.last_name}</p>
                <p><strong>Created At:</strong> {new Date(document.created_at).toLocaleDateString()}</p>
                <p><strong>Last Modified:</strong> {new Date(document.updated_at).toLocaleDateString()}</p>
              </>
            ) : (
              <p>Loading document information...</p>
            )}
          </div>
        </div>
      )
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Modern Hero Section */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center py-4 text-sm">
            <button
              onClick={() => navigate('/documents')}
              className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Back to Documents
            </button>
          </nav>

          {/* Hero Header */}
          <div className="pb-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              {/* Title and Meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <FileTypeSVG fileType={document.file_type} className="w-16 h-16 lg:w-20 lg:h-20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 leading-tight">
                      {document.title}
                    </h1>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="font-medium">{document.created_by?.first_name} {document.created_by?.last_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{new Date(document.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{document.file_size ? formatFileSize(document.file_size) : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M9 15h6" />
                          <path d="M9 18h6" />
                          <circle cx="12" cy="11" r="1" />
                        </svg>
                        <span>Version {document.version}.0</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={document.status} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 lg:flex-shrink-0">
                <button
                  onClick={handleViewDocument}
                  className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Document
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-row flex-col-2 gap-5">
          {/* Main Content Area */}
          <section className="lg:col-span-1 flex-2">
            {/* Tabs */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50">
              <div className="border-b border-slate-200/50">
                <nav className="flex space-x-8 px-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 border-b-2 font-medium text-sm transition-all flex items-center gap-2 ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-3">
                      <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Document Overview
                    </h3>
                    <div className="space-y-4">
                      <span className="text-lg font-semibold text-slate-900">Description: </span>
                      <span className="text-md text-black">{document.description}</span>
                      <div className="flex items-center gap-4">
                      </div>
                    </div>
                    {document.tags && document.tags.length > 0 && (
                      <div className="mt-6">
                        <label className="block text-sm font-semibold text-slate-500 mb-3">Tags</label>
                        <div className="flex flex-wrap gap-2">
                          {document.tags.map((tag, idx) => (
                            <span key={idx} className="bg-blue-100/80 text-blue-800 text-sm px-3 py-1 rounded-full font-medium border border-blue-200">
                              {tag.key}{tag.value ? `: ${tag.value}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}



                {activeTab === 'overview' && (
                  <div className='hidden'>
                    <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-3">
                      <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17a2 2 0 104 0 2 2 0 00-4 0zm-7-6a2 2 0 104 0 2 2 0 00-4 0zm14 2a2 2 0 100-4 2 2 0 000 4zm-7 6v-4m0 0V7m0 6H7m4 0h4" />
                      </svg>
                      Recent Activity
                    </h3>
                    <div className="space-y-4">
                      {auditLogs?.results?.length > 0 ? (
                        auditLogs.results
                          .filter((log) => {
                            // Show only key document events: create, new version, rollback
                            const isDocumentCreation = log.action === 'create' && log.resource_type === 'document';
                            const isVersionUpload = log.action === 'create' && log.resource_type === 'document_version';
                            const isRollback = log.action === 'rollback';
                            return isDocumentCreation || isVersionUpload || isRollback;
                          })
                          .slice(0, 10)
                          .map((log) => {
                            const getActivityIcon = (action) => {
                              switch (action) {
                                case 'create':
                                  return { icon: 'M12 4v16m8-8H4', bgColor: 'bg-green-100', textColor: 'text-green-600' };
                                case 'update':
                                  return { icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', bgColor: 'bg-blue-100', textColor: 'text-blue-600' };
                                case 'download':
                                  return { icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' };
                                case 'rollback':
                                  return { icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6', bgColor: 'bg-yellow-100', textColor: 'text-yellow-600' };
                                default:
                                  return { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
                              }
                            };

                            const getActivityMessage = (log) => {
                              const version = log.details?.version_number || 'unknown';
                              switch (log.action) {
                                case 'create':
                                  if (log.resource_type === 'document_version') {
                                    return `New version ${version} uploaded`;
                                  }
                                  return `Document created`;
                                case 'rollback':
                                  return `Document rolled back to version ${version}`;
                                default:
                                  return log.resource_name || `${log.action} ${log.resource_type}`;
                              }
                            };

                            const activity = getActivityIcon(log.action);

                            return (
                              <div key={log.id} className="flex items-start space-x-4 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/60 hover:shadow-md transition-all">
                                <div className={`w-10 h-10 ${activity.bgColor} rounded-full flex items-center justify-center shadow-sm`}>
                                  <svg className={`w-5 h-5 ${activity.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={activity.icon} />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-slate-900 font-semibold">{getActivityMessage(log)}</p>
                                  <p className="text-slate-500 text-sm">{new Date(log.timestamp).toLocaleString()}</p>
                                  {log.user && (
                                    <p className="text-slate-400 text-xs">by {log.user.email}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p>No activity recorded yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-6 flex flex-col lg:w-1/3">
            {/* Quick Actions */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Actions
              </h3>
              <div className="space-y-3">
                {/* Download button - always visible */}
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-between p-4 bg-blue-50/70 hover:bg-blue-100/70 rounded-xl transition-all text-left text-blue-700 group border border-blue-200/50 hover:shadow-md"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-semibold">Download</span>
                  </div>
                  <svg className="w-4 h-4 text-blue-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Version History - visible to all users */}
                <button
                  onClick={() => setShowVersionHistoryModal(true)}
                  className="w-full flex items-center justify-between p-4 bg-purple-50/70 hover:bg-purple-100/70 rounded-xl transition-all text-left text-purple-700 group border border-purple-200/50 hover:shadow-md"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold">Version History</span>
                  </div>
                  <svg className="w-4 h-4 text-purple-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Upload New Version - visible to owner only */}
                {isOwner && (
                  <button
                    onClick={() => setShowNewVersionModal(true)}
                    className="w-full flex items-center justify-between p-4 bg-green-50/70 hover:bg-green-100/70 rounded-xl transition-all text-left text-green-700 group border border-green-200/50 hover:shadow-md"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="font-semibold whitespace-nowrap">Upload New Version</span>
                    </div>
                    <svg className="w-4 h-4 text-green-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Owner-only actions */}
                {isOwner && (
                  <>

                    <button
                      onClick={() => navigate(`/documents/${id}/edit`)}
                      className="w-full flex items-center justify-between p-4 bg-amber-50/70 hover:bg-amber-100/70 rounded-xl transition-all text-left text-amber-700 group border border-amber-200/50 hover:shadow-md"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="font-semibold">Edit Document</span>
                      </div>
                      <svg className="w-4 h-4 text-amber-400 group-hover:text-amber-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    <button
                      onClick={handleDeleteClick}
                      className="w-full flex items-center justify-between p-4 bg-red-50/70 hover:bg-red-100/70 rounded-xl transition-all text-left text-red-700 group border border-red-200/50 hover:shadow-md"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="font-semibold">Delete Document</span>
                      </div>
                      <svg className="w-4 h-4 text-red-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}

                {/* Show basic info for non-owners */}
                {!isOwner && (
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/50">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-slate-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-slate-600">Document owned by {document.created_by?.first_name} {document.created_by?.last_name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Version Management Modals */}
      <VersionHistoryModal
        document={document}
        isOpen={showVersionHistoryModal}
        onClose={() => setShowVersionHistoryModal(false)}
        isOwner={isOwner}
      />

      {isOwner && (
        <NewVersionModal
          document={document}
          isOpen={showNewVersionModal}
          onClose={() => setShowNewVersionModal(false)}
        />
      )}
    </main>
  );
}

// Responsive PDF viewer component
function PDFResponsiveViewer({ PDFDocument, Page, file, pdfLoaded }) {
  const containerRef = React.useRef(null);
  const [pageWidth, setPageWidth] = React.useState(600);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      if (containerRef.current) {
        // Get the actual width of the container, minus a little padding
        const width = containerRef.current.offsetWidth - 24; // 12px padding on each side
        setPageWidth(Math.max(320, Math.min(width, 1200)));
      }
    };
    handleResize();
    const observer = new window.ResizeObserver(handleResize);
    observer.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!pdfLoaded || !PDFDocument || !Page) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-600">Loading PDF viewer...</p>
        </div>
      </div>
    );
  }
  return (
    <div ref={containerRef} className="w-full flex justify-center items-center min-h-0 flex-1" style={{ minHeight: 400 }}>
      <PDFDocument file={file} onLoadError={console.error} loading={<div>Loading PDF...</div>}>
        <Page pageNumber={1} width={pageWidth} />
      </PDFDocument>
    </div>
  );
}
