from django.shortcuts import render
from django.http import HttpResponse

def admin_index(request):
    """Simple index view that shows admin access"""
    return render(request, 'admin_index.html')
