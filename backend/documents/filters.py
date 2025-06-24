import django_filters
from .models import Document

class DocumentFilter(django_filters.FilterSet):
    created_date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="gte")
    created_date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = Document
        fields = ["status", "file_type", "tags", "created_date_from", "created_date_to"]
