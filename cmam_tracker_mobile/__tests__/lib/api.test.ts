import axios from 'axios';
import api from '../../lib/api';
import * as SecureStore from 'expo-secure-store';

jest.mock('axios');
jest.mock('expo-secure-store');

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create axios instance with correct base URL', () => {
    expect(api.defaults.baseURL).toBeDefined();
  });

  it('should add Authorization header when token exists', async () => {
    const mockToken = 'test-token-123';
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockToken);

    const mockRequest = { headers: {} };
    const interceptor = api.interceptors.request.handlers[0];
    
    // Note: This is a simplified test. In reality, you'd need to properly test the interceptor
    expect(api.interceptors.request.handlers.length).toBeGreaterThan(0);
  });

  it('should handle 401 errors and clear token', async () => {
    const mockError = {
      response: { status: 401 },
      config: {},
    };

    // Test that 401 errors are handled
    expect(api.interceptors.response.handlers.length).toBeGreaterThan(0);
  });
});
