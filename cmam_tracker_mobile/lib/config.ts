import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Environment = 'development' | 'staging' | 'production';

interface AppConfig {
  apiBaseUrl: string;
  environment: Environment;
}

// Detect if running in web browser
const isWeb = Platform.OS === 'web';

// For local development: set this to your machine's LAN IP and start Django with:
//   python manage.py runserver 0.0.0.0:8000
const LOCAL_IP = '192.168.0.101';  // Your computer's IP address
const LOCAL_API_MOBILE = `http://${LOCAL_IP}:8083/api`;
const LOCAL_API_WEB = `http://localhost:8083/api`;
const PROD_API = 'https://cmam-tracker-django-production.up.railway.app/api';

// Set USE_LOCAL_API to true only when the local Django server is running
const USE_LOCAL_API = false;

// Choose the right API URL based on platform
const getLocalApiUrl = () => {
  if (isWeb) return LOCAL_API_WEB;  // Use localhost for web browser
  return LOCAL_API_MOBILE;  // Use LAN IP for mobile devices
};

const ENV_CONFIGS: Record<Environment, AppConfig> = {
  development: {
    apiBaseUrl: USE_LOCAL_API ? getLocalApiUrl() : PROD_API,
    environment: 'development',
  },
  staging: {
    apiBaseUrl: PROD_API,
    environment: 'staging',
  },
  production: {
    apiBaseUrl: PROD_API,
    environment: 'production',
  },
};

function getEnvironment(): Environment {
  const extra = Constants.expoConfig?.extra;
  if (extra?.environment && extra.environment in ENV_CONFIGS) {
    return extra.environment as Environment;
  }
  if (__DEV__) return 'development';
  return 'production';
}

export const appConfig: AppConfig = ENV_CONFIGS[getEnvironment()];

export const COLORS = {
  primary: '#1e3a8a',
  primaryLight: '#2563eb',
  primaryDark: '#1e293b',
  secondary: '#0891b2',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  background: '#f0f4ff',
  surface: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  sam: '#dc2626',
  mam: '#d97706',
  discharged: '#16a34a',
};
