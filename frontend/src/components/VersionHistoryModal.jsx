import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsAPI } from '../services/api';
import { Clock, Download, RotateCcw, FileText, Tag, X, Trash2 } from 'lucide-react';

const VersionHistoryModal = ({ document, isOpen, onClose, isOwner = false }) => {
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState(null);

  const { data: versionHistory, isLoading } = useQuery({
    queryKey: ['document-versions', document?.id],
    queryFn: () => documentsAPI.getDocumentVersionHistory(document.id),
    enabled: !!document?.id && isOpen
  });

  const rollbackMutation = useMutation({
    mutationFn: ({ documentId, versionId }) => 
      documentsAPI.rollbackDocument(documentId, versionId),
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates with rollback details
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-versions', document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-audit', document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-metadata', document.id] });
      onClose();
    },
    onError: (error) => {
      console.error('Rollback error:', error);
      alert('Failed to rollback document. Please try again.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ documentId, versionId }) => 
      documentsAPI.deleteDocumentVersion(documentId, versionId),
    onSuccess: () => {
      // Invalidate queries to refresh version list
      queryClient.invalidateQueries({ queryKey: ['document-versions', document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-audit', document.id] });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      alert('Failed to delete version. ' + (error.response?.data?.detail || 'Please try again.'));
    }
  });

  const handleRollback = (version) => {
    if (window.confirm(`Are you sure you want to rollback to version ${version.version_number}?`)) {
      rollbackMutation.mutate({
        documentId: document.id,
        versionId: version.id
      });
    }
  };

  const handleDelete = (version) => {
    if (window.confirm(`Are you sure you want to delete version ${version.version_number}? This action cannot be undone.`)) {
      deleteMutation.mutate({
        documentId: document.id,
        versionId: version.id
      });
    }
  };

  const handleDownload = (version) => {
    if (version.download_url) {
      window.open(version.download_url, '_blank');
    } else {
      // Fallback to API call if download_url is not available
      documentsAPI.downloadDocumentVersion(document.id, version.id)
        .then(response => {
          // Create blob URL and download
          const url = window.URL.createObjectURL(response);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${version.title || document.title}_v${version.version_number}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        })
        .catch(error => {
          console.error('Download error:', error);
          alert('Failed to download document version. Please try again.');
        });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Version History</h2>
            <p className="text-sm text-gray-600 mt-1">{document?.title}</p>
            {!isOwner && (
              <p className="text-xs text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded-md inline-block">
                View only - Document owned by {document?.created_by?.first_name} {document?.created_by?.last_name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading version history...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {versionHistory?.versions?.map((version) => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${
                    version.is_current
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } transition-colors`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <FileText size={20} className="text-gray-500" />
                          <span className="font-medium text-gray-900">
                            Version {version.version_number}
                          </span>
                          {version.is_current && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock size={16} />
                          <span>{new Date(version.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">{version.title}</h4>
                          {version.description && (
                            <p className="text-sm text-gray-600 mb-2">{version.description}</p>
                          )}
                          {version.changes_description && (
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Changes:</span> {version.changes_description}
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Created by:</span> {version.created_by?.email}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">File size:</span> {formatFileSize(version.file_size)}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">File type:</span> {version.file_type?.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      {version.tags && version.tags.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <Tag size={16} className="text-gray-500" />
                          <div className="flex flex-wrap gap-1">
                            {version.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                              >
                                {tag.display_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {/* Download button - always visible */}
                      <button
                        onClick={() => handleDownload(version)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download size={16} />
                        Download
                      </button>
                      
                      {/* Rollback button - only for owners on non-current versions */}
                      {!version.is_current && isOwner && (
                        <button
                          onClick={() => handleRollback(version)}
                          disabled={rollbackMutation.isLoading}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw size={16} />
                          Rollback
                        </button>
                      )}

                      {/* Delete button - only for owners on non-current versions */}
                      {!version.is_current && isOwner && (
                        <button
                          onClick={() => handleDelete(version)}
                          disabled={deleteMutation.isLoading}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;
