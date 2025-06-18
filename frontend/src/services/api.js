import apiClient from './axios';

// Authentication API
export const authAPI = {
  // User registration
  register: async (userData) => {
    const response = await apiClient.post('/auth/register/', userData);
    return response.data;
  },

  // User login
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login/', credentials);
    return response.data;
  },

  // User logout
  logout: async (refreshToken) => {
    const response = await apiClient.post('/auth/logout/', { refresh_token: refreshToken });
    return response.data;
  },

  // Get user profile
  getProfile: async () => {
    const response = await apiClient.get('/auth/profile/');
    return response.data;
  },

  // Update user profile
  updateProfile: async (userData) => {
    const response = await apiClient.put('/auth/profile/', userData);
    return response.data;
  },

  // Change password
  changePassword: async (passwordData) => {
    const response = await apiClient.post('/auth/password/change/', passwordData);
    return response.data;
  },

  // Upload avatar
  uploadAvatar: async (avatarFile) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    
    const response = await apiClient.patch('/auth/avatar/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete avatar
  deleteAvatar: async () => {
    const response = await apiClient.delete('/auth/avatar/delete/');
    return response.data;
  },

  // MFA setup
  setupMFA: async () => {
    const response = await apiClient.get('/auth/mfa/setup/');
    return response.data;
  },

  // Verify MFA token
  verifyMFA: async (token, userId) => {
    const response = await apiClient.post('/auth/mfa/verify/', { token, user_id: userId });
    return response.data;
  },

  // Enable MFA
  enableMFA: async (token) => {
    const response = await apiClient.post('/auth/mfa/enable/', { token });
    return response.data;
  },

  // Disable MFA
  disableMFA: async () => {
    const response = await apiClient.post('/auth/mfa/disable/');
    return response.data;
  },
};

// Documents API
export const documentsAPI = {
  // Get all documents
  getDocuments: async (params = {}) => {
    const response = await apiClient.get('/documents/', { params });
    return response.data;
  },

  // Get single document
  getDocument: async (id) => {
    const response = await apiClient.get(`/documents/${id}/`);
    return response.data;
  },
  // Create document
  createDocument: async (documentData) => {
    const formData = new FormData();
    
    // Append all fields to FormData
    Object.keys(documentData).forEach(key => {
      if (key === 'tags_data' && Array.isArray(documentData[key])) {
        formData.append('tags_data', JSON.stringify(documentData[key]));
      } else if (key === 'tag_ids' && Array.isArray(documentData[key])) {
        documentData[key].forEach(tagId => {
          formData.append('tag_ids', tagId);
        });
      } else if (documentData[key] !== null && documentData[key] !== undefined && documentData[key] !== '') {
        formData.append(key, documentData[key]);
      }
    });

    const response = await apiClient.post('/documents/create/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Update document
  updateDocument: async (id, documentData) => {
    const formData = new FormData();
    
    // Append all fields to FormData
    Object.keys(documentData).forEach(key => {
      if (key === 'tag_ids' && Array.isArray(documentData[key])) {
        documentData[key].forEach(tagId => {
          formData.append('tag_ids', tagId);
        });
      } else if (documentData[key] !== null && documentData[key] !== undefined) {
        formData.append(key, documentData[key]);
      }
    });

    const response = await apiClient.put(`/documents/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete document (soft delete)
  deleteDocument: async (id) => {
    const response = await apiClient.delete(`/documents/${id}/`);
    return response.data;
  },

  // Restore deleted document
  restoreDocument: async (id) => {
    const response = await apiClient.post(`/documents/${id}/restore/`);
    return response.data;
  },

  // Get deleted documents
  getDeletedDocuments: async () => {
    const response = await apiClient.get('/documents/deleted/');
    return response.data;
  },

  // Download document
  downloadDocument: async (id) => {
    const response = await apiClient.post(`/documents/${id}/download/`);
    return response.data;
  },

  // Share document
  shareDocument: async (id, shareData) => {
    const response = await apiClient.post(`/documents/${id}/share/`, shareData);
    return response.data;
  },

  // Get document versions
  getDocumentVersions: async (documentId) => {
    const response = await apiClient.get(`/documents/${documentId}/versions/`);
    return response.data;
  },
};

// Tags API
export const tagsAPI = {
  // Get all tags
  getTags: async () => {
    const response = await apiClient.get('/tags/');
    return response.data;
  },

  // Get tag suggestions for auto-complete
  getTagSuggestions: async (query = '') => {
    const response = await apiClient.get('/tags/suggestions/', {
      params: { q: query }
    });
    return response.data;
  },

  // Get single tag
  getTag: async (id) => {
    const response = await apiClient.get(`/tags/${id}/`);
    return response.data;
  },

  // Create tag
  createTag: async (tagData) => {
    const response = await apiClient.post('/tags/', tagData);
    return response.data;
  },

  // Update tag
  updateTag: async (id, tagData) => {
    const response = await apiClient.put(`/tags/${id}/`, tagData);
    return response.data;
  },

  // Delete tag
  deleteTag: async (id) => {
    const response = await apiClient.delete(`/tags/${id}/`);
    return response.data;
  },
};

// Audit API
export const auditAPI = {
  // Get audit logs
  getAuditLogs: async (params = {}) => {
    const response = await apiClient.get('/audit/logs/', { params });
    return response.data;
  },

  // Get single audit log
  getAuditLog: async (id) => {
    const response = await apiClient.get(`/audit/logs/${id}/`);
    return response.data;
  },
};
