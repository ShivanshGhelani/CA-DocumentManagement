# Document Management System

A comprehensive, enterprise-grade document management system built with Django REST Framework and React. This system provides secure document storage, version control, collaboration features, and advanced audit logging capabilities.

## 🚀 Features

### Core Features
- **Secure Document Storage**: Store documents with AWS S3 integration and local file system support
- **User Authentication**: JWT-based authentication with multi-factor authentication (MFA) support
- **Document Versioning**: Complete version history with rollback capabilities
- **Tagging System**: Flexible key-value tag system for document organization
- **Access Control**: Role-based permissions and document sharing
- **Audit Logging**: Comprehensive activity tracking and audit trails
- **Soft Delete**: Safe document deletion with restore functionality

### Advanced Features
- **Real-time Collaboration**: Share documents with customizable permissions
- **Document Preview**: Support for PDF, image, and text document preview
- **Search & Filter**: Advanced filtering and search capabilities
- **Storage Analytics**: Monitor storage usage and generate reports
- **Email Notifications**: Password reset and MFA backup codes via email
- **API Documentation**: RESTful API with comprehensive endpoints

### Security Features
- **Multi-Factor Authentication (MFA)**: TOTP-based two-factor authentication
- **Password Security**: Strong password validation and secure reset
- **JWT Token Management**: Secure token-based authentication with refresh tokens
- **Access Logging**: Detailed audit logs for all user activities
- **File Security**: Secure file upload with validation and S3 encryption

## 🏗️ Architecture

### Backend (Django REST Framework)
```
backend/
├── accounts/           # User management and authentication
├── documents/          # Document management and versioning
├── audit/             # Activity logging and audit trails
├── admin_index/       # Custom admin interface
├── backend/           # Project configuration
└── templates/         # Email and admin templates
```

### Frontend (React with React Router)
```
frontend/
├── src/
│   ├── components/    # Reusable React components
│   ├── pages/         # Application pages
│   ├── services/      # API client and services
│   └── hooks/         # Custom React hooks
└── app/               # React Router configuration
```

## 🛠️ Technology Stack

### Backend Technologies
- **Django 4.2.22**: Web framework
- **Django REST Framework**: API development
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Celery**: Background task processing
- **AWS S3**: Cloud file storage
- **JWT**: Authentication tokens
- **pytest**: Testing framework

### Frontend Technologies
- **React 19**: UI library
- **React Router 7**: Client-side routing
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client
- **React Query**: Data fetching and caching
- **Formik & Yup**: Form handling and validation

### DevOps & Infrastructure
- **Docker**: Containerization
- **Docker Compose**: Multi-service orchestration
- **Vite**: Frontend build tool
- **PostgreSQL**: Database
- **Redis**: Cache and message broker
- **AWS S3**: File storage

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.9+ (for local backend development)
- AWS account (for S3 storage)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/ShivanshGhelani/CA-DocumentManagement.git
cd CA-DocumentManagement
```

### 2. Environment Setup

Create environment files:

**Backend (.env)**
```bash
# Database Configuration
DB_NAME=document_db
DB_USER=shiv9090
DB_PASSWORD=shiv9090
DB_HOST=db
DB_PORT=5432

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_STORAGE_BUCKET_NAME=your_bucket_name
AWS_S3_REGION_NAME=us-east-1
USE_S3_STORAGE=true

# Redis Configuration
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_password

# Security
SECRET_KEY=your_secret_key_here
DEBUG=true
```

**Frontend (.env)**
```bash
VITE_API_URL=http://localhost:8000/api
```

### 3. Run with Docker Compose
```bash
# Start all services
docker-compose up --build

# Run in detached mode
docker-compose up -d --build
```

### 4. Initialize the Database
```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api
- **Admin Panel**: http://localhost:8000/admin
- **Database Admin**: http://localhost:8080 (Adminer)

## 🔧 Development Setup

### Local Backend Development
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

### Local Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📊 API Documentation

### Authentication Endpoints
```
POST /api/auth/register/          # User registration
POST /api/auth/login/             # User login
POST /api/auth/logout/            # User logout
POST /api/auth/token/refresh/     # Refresh JWT token
POST /api/auth/mfa/setup/         # Setup MFA
POST /api/auth/mfa/verify/        # Verify MFA token
```

### Document Management
```
GET    /api/documents/            # List documents
POST   /api/documents/create/     # Create document
GET    /api/documents/{id}/       # Get document details
PUT    /api/documents/{id}/       # Update document
DELETE /api/documents/{id}/       # Delete document (soft)
POST   /api/documents/{id}/share/ # Share document
GET    /api/documents/{id}/download/ # Download document
```

### Tag Management
```
GET  /api/tags/                   # List tags
POST /api/tags/                   # Create tag
GET  /api/tags/{id}/              # Get tag details
PUT  /api/tags/{id}/              # Update tag
DELETE /api/tags/{id}/            # Delete tag
```

## 🧪 Testing

### Backend Tests
```bash
# Run all tests
docker-compose exec backend pytest

# Run with coverage
docker-compose exec backend pytest --cov

# Run specific test file
docker-compose exec backend pytest documents/tests.py
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🏢 Production Deployment

### Environment Configuration
1. Set `DEBUG=false` in backend environment
2. Configure proper `ALLOWED_HOSTS`
3. Use production database (PostgreSQL)
4. Set up proper S3 bucket with appropriate permissions
5. Configure email service (SMTP)
6. Set strong `SECRET_KEY`

### Docker Production Build
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 🔒 Security Features

### Authentication & Authorization
- JWT-based stateless authentication
- Multi-factor authentication (TOTP)
- Password strength validation
- Secure password reset workflow
- Role-based access control

### Data Protection
- HTTPS enforcement in production
- CORS configuration
- SQL injection prevention
- XSS protection
- CSRF protection
- File upload validation

### Audit & Compliance
- Comprehensive audit logging
- User activity tracking
- Document access monitoring
- Change history tracking
- Storage usage analytics

## 📁 Project Structure

### Backend Models
- **User**: Custom user model with MFA support
- **Document**: Main document model with versioning
- **DocumentVersion**: Version history tracking
- **Tag**: Key-value tagging system
- **DocumentAccess**: Permission management
- **AuditLog**: Activity logging

### Key Features Implementation
- **Soft Delete**: Documents are marked as deleted but not permanently removed
- **Version Control**: Complete document history with rollback capabilities
- **S3 Integration**: Seamless cloud storage with local fallback
- **Tag Synchronization**: Automatic S3 object tagging
- **Access Control**: Fine-grained permission system

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Shivansh Ghelani** - *Initial work* - [ShivanshGhelani](https://github.com/ShivanshGhelani)

## 🆘 Support

If you encounter any issues or have questions, please:

1. Check the [Issues](https://github.com/ShivanshGhelani/CA-DocumentManagement/issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🎯 Roadmap

- [ ] Real-time collaboration features
- [ ] Advanced document analytics
- [ ] Mobile application
- [ ] Document workflow automation
- [ ] Integration with third-party services
- [ ] Enhanced search capabilities
- [ ] Bulk operations support

---

**Built with ❤️ by the Shivansh Ghelani(CreART Solutions)**