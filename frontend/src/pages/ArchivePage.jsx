import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { documentsAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth.jsx';

const ArchivePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unarchivingId, setUnarchivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      documentsAPI.getDocuments({ status: 'archived' })
        .then(data => setDocuments(data.results || []))
        .catch(() => setError('Failed to load archived documents.'))
        .finally(() => setLoading(false));
    }
  }, [authLoading, isAuthenticated]);

  const handleUnarchive = async (doc) => {
    setUnarchivingId(doc.id);
    try {
      // Unarchive by setting status to draft
      await documentsAPI.archiveDocument(doc.id, 'draft');
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch {
      alert('Failed to unarchive document.');
    } finally {
      setUnarchivingId(null);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Are you sure you want to permanently delete this document? This action cannot be undone.')) return;
    setDeletingId(doc.id);
    try {
      await documentsAPI.deletePermanently(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch {
      alert('Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Archived Documents</h1>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No archived documents found.</div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-blue-700 cursor-pointer" onClick={() => navigate(`/documents/${doc.id}`)}>{doc.title}</td>
                      <td className="px-3 py-4">{doc.description || '-'}</td>
                      <td className="px-3 py-4">{new Date(doc.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-4 flex gap-2">
                        <button
                          onClick={() => handleUnarchive(doc)}
                          disabled={unarchivingId === doc.id}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                          title="Unarchive"
                        >
                          {unarchivingId === doc.id ? (
                            <span className="flex items-center"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-2"></span>Unarchiving...</span>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" />
                              </svg>
                              Unarchive
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.id}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                          title="Delete document"
                        >
                          {deletingId === doc.id ? (
                            <span className="flex items-center"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-2"></span>Deleting...</span>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                        <button onClick={() => navigate(`/documents/${doc.id}`)} className="text-blue-600 hover:text-blue-800 font-medium" title="View">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivePage;