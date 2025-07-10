from django.urls import path
from . import views

urlpatterns = [    # Tags
    path('tags/', views.TagListCreateView.as_view(), name='tag-list-create'),
    path('tags/<int:pk>/', views.TagDetailView.as_view(), name='tag-detail'),
    path('tags/suggestions/', views.tag_suggestions, name='tag-suggestions'),
    
    # Documents
    path('documents/', views.DocumentListView.as_view(), name='document-list'),
    path('documents/create/', views.DocumentCreateView.as_view(), name='document-create'),
    path('documents/deleted/', views.deleted_documents, name='deleted-documents'),
    path('documents/<uuid:pk>/', views.DocumentDetailView.as_view(), name='document-detail'),
    path('documents/<uuid:pk>/download/', views.document_download, name='document-download'),
    path('documents/<uuid:pk>/share/', views.document_share, name='document-share'),
    path('documents/<uuid:pk>/restore/', views.restore_document, name='document-restore'),
    path('documents/<uuid:pk>/permanent/', views.permanent_delete_document, name='document-permanent-delete'),
    path('documents/<uuid:pk>/upload-version/', views.upload_document_version, name='document-upload-version'),
    
    # Document Versions
    path('documents/<uuid:pk>/versions/', views.document_version_history, name='document-version-history'),
    path('documents/<uuid:pk>/versions/create/', views.create_document_version, name='create-document-version'),
    path('documents/<uuid:pk>/versions/<uuid:version_id>/download/', views.download_document_version, name='download-document-version'),
    path('documents/<uuid:pk>/versions/<uuid:version_id>/delete/', views.delete_document_version, name='delete-document-version'),
    path('documents/<uuid:pk>/rollback/', views.rollback_document, name='rollback-document'),
    path('documents/<uuid:pk>/metadata/', views.get_document_metadata_for_version, name='get-document-metadata'),
]
