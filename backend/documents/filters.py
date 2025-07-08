import django_filters
from django.db.models import Q
from .models import Document

class DocumentFilter(django_filters.FilterSet):
    created_date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="gte")
    created_date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="lte")
    file_type = django_filters.CharFilter(method='filter_file_type')
    created_by = django_filters.CharFilter(field_name="created_by__id")
    
    class Meta:
        model = Document
        fields = ["status", "tags", "created_date_from", "created_date_to", "created_by"]
    
    def filter_file_type(self, queryset, name, value):
        """Filter by file type from the current version"""
        if value:
            return queryset.filter(current_version__file_type__iexact=value)
        return queryset
