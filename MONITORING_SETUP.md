# CMAM Tracker - Monitoring & Error Tracking Setup

This guide covers setting up monitoring, error tracking, and analytics for the CMAM Tracker system.

## Overview

Recommended services:
- **Sentry**: Error tracking and crash reporting
- **Firebase**: Analytics, Crashlytics, Performance Monitoring
- **Uptime monitoring**: UptimeRobot or Pingdom
- **Log aggregation**: Papertrail or Loggly

---

## 1. Sentry (Error Tracking)

### Backend (Django)

1. **Install Sentry SDK**:
```bash
cd cmam-tracker-django
pip install sentry-sdk
```

2. **Configure in `config/settings.py`**:
```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn="https://your-dsn@sentry.io/project-id",
    integrations=[DjangoIntegration()],
    traces_sample_rate=0.1,  # 10% of transactions
    send_default_pii=False,  # Don't send personally identifiable information
    environment="production",  # or "development", "staging"
)
```

3. **Test error tracking**:
```python
# In any view
from sentry_sdk import capture_exception

try:
    # Your code
    pass
except Exception as e:
    capture_exception(e)
```

### Mobile App (React Native)

1. **Install Sentry**:
```bash
cd cmam_tracker_mobile
npx expo install @sentry/react-native
```

2. **Configure in `app/_layout.tsx`**:
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://your-dsn@sentry.io/project-id',
  enableInExpoDevelopment: false,
  debug: false,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.1,
});
```

3. **Wrap root component**:
```typescript
export default Sentry.wrap(RootLayout);
```

4. **Track errors**:
```typescript
import * as Sentry from '@sentry/react-native';

try {
  // Your code
} catch (error) {
  Sentry.captureException(error);
}
```

---

## 2. Firebase (Analytics & Crashlytics)

### Mobile App

1. **Install Firebase**:
```bash
npx expo install @react-native-firebase/app @react-native-firebase/analytics @react-native-firebase/crashlytics
```

2. **Configure Firebase**:
   - Create project at https://console.firebase.google.com
   - Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   - Place in appropriate directories

3. **Initialize in `app/_layout.tsx`**:
```typescript
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

// Track screen views
analytics().logScreenView({
  screen_name: 'Dashboard',
  screen_class: 'DashboardScreen',
});

// Track events
analytics().logEvent('case_registered', {
  case_type: 'SAM',
  facility_id: 5,
});

// Log crashes
crashlytics().log('User action performed');
crashlytics().recordError(new Error('Test error'));
```

### Backend

1. **Install Firebase Admin SDK**:
```bash
pip install firebase-admin
```

2. **Configure in Django**:
```python
import firebase_admin
from firebase_admin import credentials

cred = credentials.Certificate('path/to/serviceAccountKey.json')
firebase_admin.initialize_app(cred)
```

---

## 3. Application Performance Monitoring (APM)

### Backend - Django Debug Toolbar (Development)

```bash
pip install django-debug-toolbar
```

Add to `INSTALLED_APPS` and middleware in `settings.py`.

### Backend - New Relic (Production)

1. **Install**:
```bash
pip install newrelic
```

2. **Configure**:
```bash
newrelic-admin generate-config YOUR_LICENSE_KEY newrelic.ini
```

3. **Run with New Relic**:
```bash
NEW_RELIC_CONFIG_FILE=newrelic.ini newrelic-admin run-program gunicorn config.wsgi
```

### Mobile - React Native Performance

```bash
npx expo install @react-native-firebase/perf
```

```typescript
import perf from '@react-native-firebase/perf';

// Trace API calls
const trace = await perf().startTrace('api_call');
await api.get('/cases/');
await trace.stop();

// Custom metrics
trace.putMetric('cases_loaded', 50);
```

---

## 4. Uptime Monitoring

### UptimeRobot

1. Sign up at https://uptimerobot.com
2. Add monitor:
   - **Type**: HTTP(s)
   - **URL**: https://nutri.pharn.org/api/health/
   - **Interval**: 5 minutes
   - **Alert contacts**: Email, SMS

### Pingdom

1. Sign up at https://www.pingdom.com
2. Create uptime check for API and web app
3. Set up alerts

---

## 5. Log Aggregation

### Papertrail

1. Sign up at https://papertrailapp.com
2. Configure Django logging:

```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'papertrail': {
            'level': 'INFO',
            'class': 'logging.handlers.SysLogHandler',
            'address': ('logs.papertrailapp.com', YOUR_PORT),
        },
    },
    'loggers': {
        'django': {
            'handlers': ['papertrail'],
            'level': 'INFO',
        },
    },
}
```

---

## 6. Database Monitoring

### PostgreSQL

1. **Enable slow query logging**:
```sql
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
SELECT pg_reload_conf();
```

2. **Monitor with pgAdmin or pgBadger**

### Query Performance

```python
# Django - Log slow queries
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    },
}
```

---

## 7. Custom Health Checks

### Backend

Create `apps/core/health.py`:

```python
from django.http import JsonResponse
from django.db import connection

def health_check(request):
    """Comprehensive health check"""
    status = {
        'status': 'healthy',
        'database': 'unknown',
        'cache': 'unknown',
    }
    
    # Check database
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        status['database'] = 'healthy'
    except Exception as e:
        status['database'] = 'unhealthy'
        status['status'] = 'unhealthy'
    
    # Check cache
    try:
        from django.core.cache import cache
        cache.set('health_check', 'ok', 10)
        if cache.get('health_check') == 'ok':
            status['cache'] = 'healthy'
    except Exception:
        status['cache'] = 'unhealthy'
    
    return JsonResponse(status)
```

### Mobile App

```typescript
// lib/health.ts
export async function checkAppHealth() {
  const health = {
    api: false,
    storage: false,
    network: false,
  };
  
  try {
    const response = await api.get('/health/');
    health.api = response.status === 200;
  } catch {
    health.api = false;
  }
  
  try {
    await SecureStore.setItemAsync('health_check', 'ok');
    health.storage = true;
  } catch {
    health.storage = false;
  }
  
  const netInfo = await NetInfo.fetch();
  health.network = netInfo.isConnected ?? false;
  
  return health;
}
```

---

## 8. Alerting

### Email Alerts (Django)

```python
# settings.py
ADMINS = [('Admin', 'admin@pharn.org')]
SERVER_EMAIL = 'noreply@pharn.org'

# Email on errors
LOGGING = {
    'handlers': {
        'mail_admins': {
            'level': 'ERROR',
            'class': 'django.utils.log.AdminEmailHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['mail_admins'],
            'level': 'ERROR',
        },
    },
}
```

### Slack Notifications

Integrate with Slack webhooks for critical alerts:

```python
import requests

def send_slack_alert(message):
    webhook_url = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
    requests.post(webhook_url, json={'text': message})
```

---

## 9. Metrics Dashboard

### Grafana + Prometheus

1. **Install Prometheus exporter**:
```bash
pip install django-prometheus
```

2. **Configure Django**:
```python
INSTALLED_APPS = ['django_prometheus'] + INSTALLED_APPS
MIDDLEWARE = ['django_prometheus.middleware.PrometheusBeforeMiddleware'] + MIDDLEWARE + ['django_prometheus.middleware.PrometheusAfterMiddleware']
```

3. **Set up Grafana dashboards** for:
   - Request rate
   - Response time
   - Error rate
   - Database queries
   - Active users

---

## 10. Security Monitoring

### Django Security Middleware

```python
# settings.py
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
```

### Rate Limiting

```bash
pip install django-ratelimit
```

```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='100/h')
def api_view(request):
    pass
```

---

## Monitoring Checklist

- [ ] Sentry configured for error tracking
- [ ] Firebase Analytics tracking user behavior
- [ ] Crashlytics capturing mobile crashes
- [ ] Uptime monitoring active
- [ ] Log aggregation configured
- [ ] Database slow query logging enabled
- [ ] Health check endpoints created
- [ ] Email/Slack alerts configured
- [ ] APM tool integrated (optional)
- [ ] Security headers configured
- [ ] Rate limiting enabled

---

## Testing Monitoring

### Test Error Tracking

```python
# Backend
raise Exception("Test error for Sentry")
```

```typescript
// Mobile
throw new Error('Test error for Sentry');
```

### Test Analytics

```typescript
// Mobile
analytics().logEvent('test_event', { test: true });
```

### Test Health Check

```bash
curl https://nutri.pharn.org/api/health/
```

---

## Support

For monitoring setup assistance:
- Sentry Docs: https://docs.sentry.io
- Firebase Docs: https://firebase.google.com/docs
- Django Logging: https://docs.djangoproject.com/en/stable/topics/logging/
