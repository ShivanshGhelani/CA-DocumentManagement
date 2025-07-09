import requests
import os

# Test the document version upload API
def test_upload_version():
    # Use a document ID that exists (from the error message)
    document_id = "baeef503-6c18-4c38-917b-e05b9f74d88a"
    
    # Prepare the file
    test_file_path = "test_upload.txt"
    
    url = f"http://localhost:8000/api/documents/{document_id}/versions/create/"
    
    # Prepare the form data
    files = {
        'file': ('test_upload.txt', open(test_file_path, 'rb'), 'text/plain')
    }
    
    data = {
        'inherit_metadata': 'true',
        'changes_description': 'Testing new version upload',
        'reason': 'Testing upload functionality'
    }
    
    # Add authentication headers (you'll need to get a valid token)
    headers = {
        'Authorization': 'Token YOUR_AUTH_TOKEN_HERE'
    }
    
    response = requests.post(url, files=files, data=data, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    files['file'][1].close()

if __name__ == "__main__":
    test_upload_version()
