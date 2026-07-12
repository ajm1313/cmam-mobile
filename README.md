# CMAM Tracker System

A comprehensive Community Management of Acute Malnutrition (CMAM) tracking system with Django backend, web interface, and React Native mobile application.

## 🎯 Project Overview

The CMAM Tracker system helps health facilities manage and track cases of acute malnutrition (SAM, MAM, and IPC), inventory, visits, and generate reports.

### Components

1. **Backend API** (`cmam-tracker-django/`) - Django REST API
2. **Web Interface** (`cmam-tracker-django/templates/`) - Django templates
3. **Mobile App** (`cmam_tracker_mobile/`) - React Native/Expo app

---

## ✅ Feature Completion Status

### Backend (100% Complete)
- ✅ 110 REST API endpoints
- ✅ 52 web templates
- ✅ Full CRUD for all entities
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Import/Export functionality
- ✅ Comprehensive reporting
- ✅ Production deployment

### Mobile App (100% Complete)
- ✅ 40+ screens
- ✅ Offline support with caching
- ✅ Photo upload & GPS tracking
- ✅ Case management (SAM/MAM/IPC)
- ✅ Visit recording and editing
- ✅ Inventory management
- ✅ Stock tracking and requests
- ✅ User and facility management
- ✅ Reports and analytics
- ✅ Admin features

---

## 🚀 Quick Start

### Backend Setup

```bash
cd cmam-tracker-django

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

Access at: http://localhost:8000

### Mobile App Setup

```bash
cd cmam_tracker_mobile

# Install dependencies
npm install

# Start development server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```

---

## 📱 Mobile App Features

### Main Screens
- **Dashboard**: Statistics, quick actions, analytics
- **Cases**: List, register, edit, discharge SAM/MAM/IPC cases
- **Inventory**: Stock management, consumption tracking
- **Reports**: Weekly SAM/MAM tallies, monthly facility reports
- **Profile**: User settings, password change
- **Admin Hub**: Management navigation

### Admin Features
- User management (CRUD)
- Facility management (CRUD)
- Location management (regions, districts, sub-districts)
- Inventory items (CRUD)
- Stock levels and movements
- Stock requests
- Expiry management
- Access control (roles and permissions)

### Technical Features
- Offline-first architecture with caching
- JWT authentication with secure storage
- Photo upload for case documentation
- GPS location tracking
- Error boundaries and loading states
- Pull-to-refresh
- Search and filtering

---

## 🔧 Technology Stack

### Backend
- **Framework**: Django 5.0.1
- **API**: Django REST Framework
- **Authentication**: JWT (Simple JWT)
- **Database**: PostgreSQL (production), SQLite (development)
- **Server**: Gunicorn + Nginx
- **Deployment**: Docker, Shared Hosting

### Mobile App
- **Framework**: React Native 0.81.5
- **Runtime**: Expo 54
- **Routing**: Expo Router 6 (file-based)
- **Language**: TypeScript
- **State**: Zustand
- **HTTP**: Axios
- **Storage**: Expo SecureStore, AsyncStorage
- **UI**: React Native components, Ionicons

---

## 📚 Documentation

- **API Documentation**: [`cmam-tracker-django/API_DOCUMENTATION.md`](./cmam-tracker-django/API_DOCUMENTATION.md)
- **Mobile Deployment**: [`cmam_tracker_mobile/DEPLOYMENT.md`](./cmam_tracker_mobile/DEPLOYMENT.md)
- **Monitoring Setup**: [`MONITORING_SETUP.md`](./MONITORING_SETUP.md)
- **Progress Tracking**: [`progress.md`](./progress.md)

---

## 🌐 Production Deployment

### Backend
- **URL**: https://nutri.pharn.org
- **API**: https://nutri.pharn.org/api/v1
- **Status**: ✅ Live

### Mobile App
- **Platform**: Android, iOS
- **Distribution**: Google Play Store, Apple App Store (pending)
- **Build Tool**: EAS Build

---

## 🧪 Testing

### Backend Tests
```bash
cd cmam-tracker-django
python manage.py test
```

### Mobile App Tests
```bash
cd cmam_tracker_mobile

# Install test dependencies first
npm install

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 📊 API Endpoints

### Authentication
- `POST /v1/login/` - Login
- `POST /v1/logout/` - Logout
- `GET /v1/profile/` - Get profile
- `POST /v1/change-password/` - Change password

### Cases
- `GET /v1/cases/` - List cases
- `POST /v1/cases/create/` - Register case
- `GET /v1/cases/<id>/` - Get case details
- `PUT /v1/cases/<id>/edit/` - Edit case
- `DELETE /v1/cases/<id>/delete/` - Delete case
- `POST /v1/cases/<id>/discharge/` - Discharge case
- `GET /v1/cases/due-visits/` - Due visits

### Visits
- `GET /v1/cases/<id>/visits/` - List visits
- `POST /v1/cases/<id>/visits/record/` - Record visit
- `PUT /v1/cases/<id>/visits/<visit_id>/edit/` - Edit visit

### Inventory
- `GET /v1/inventory/items/` - List items
- `GET /v1/inventory/facility/<id>/stock/` - Facility stock
- `POST /v1/inventory/consumption/` - Record consumption
- `GET /v1/inventory/stock-levels/` - Stock levels
- `GET /v1/inventory/movements/` - Stock movements
- `GET /v1/inventory/requests/` - Stock requests

### Reports
- `GET /v1/reports/summary/` - Summary statistics
- `GET /v1/reports/weekly/` - Weekly SAM/MAM report
- `GET /v1/reports/monthly/` - Monthly facility report

[See full API documentation](./cmam-tracker-django/API_DOCUMENTATION.md)

---

## 🔐 Security

- JWT token authentication
- Role-based access control
- Secure password hashing (PBKDF2)
- HTTPS enforced in production
- SQL injection protection (Django ORM)
- XSS protection
- CSRF protection
- Rate limiting (recommended)

---

## 📦 Database Schema

### Core Models
- **User**: System users with roles
- **Role**: User roles and permissions
- **Facility**: Health facilities
- **Region, District, SubDistrict**: Location hierarchy

### Case Management
- **OpcRegistration**: Case registrations (SAM/MAM/IPC)
- **OpcVisit**: Follow-up visits
- **Discharge**: Discharge records

### Inventory
- **InventoryItem**: Items (RUTF, medicines, etc.)
- **StockLevel**: Current stock at facilities
- **StockMovement**: Stock transactions
- **StockRequest**: Stock requests between facilities
- **ItemBatch**: Batch tracking with expiry dates

---

## 🛠️ Development

### Backend Development
```bash
# Run development server
python manage.py runserver

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic
```

### Mobile Development
```bash
# Start Metro bundler
npx expo start

# Clear cache
npx expo start --clear

# Run on specific device
npx expo run:android --device <device-name>

# Build for production
eas build --platform android --profile production
```

---

## 📈 Monitoring (Optional)

Recommended integrations:
- **Sentry**: Error tracking
- **Firebase**: Analytics and Crashlytics
- **UptimeRobot**: Uptime monitoring
- **Papertrail**: Log aggregation

[See monitoring setup guide](./MONITORING_SETUP.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is proprietary software developed for CMAM health facilities.

---

## 👥 Support

For technical support or questions:
- **Email**: support@pharn.org
- **Documentation**: https://nutri.pharn.org/docs
- **Issue Tracker**: GitHub Issues

---

## 🎉 Acknowledgments

- Health facilities using the system
- Development team
- CMAM program coordinators
- Community health workers

---

## 📅 Version History

### v1.0.0 (Current)
- ✅ Complete backend API with 110 endpoints
- ✅ Full-featured mobile app with 40+ screens
- ✅ Web interface with 52 templates
- ✅ Offline support and caching
- ✅ Import/Export functionality
- ✅ Comprehensive reporting
- ✅ Production deployment

---

## 🔮 Roadmap

### Planned Enhancements
- [ ] Automated testing suite
- [ ] CI/CD pipeline
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] SMS notifications
- [ ] Biometric authentication
- [ ] Data synchronization improvements
- [ ] Performance optimizations

---

**Built with ❤️ for better child nutrition outcomes**
