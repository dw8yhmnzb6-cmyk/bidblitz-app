/**
 * Axios configuration with global error handling
 * Prevents "Not Found" and similar technical errors from being shown to users
 */
import axios from 'axios';
import { toast } from 'sonner';

// List of error messages that should be silently ignored (case insensitive)
const SILENT_ERROR_PATTERNS = [
  'not found',
  'user not found',
  'auction not found',
  'product not found',
  'resource not found',
  'method not allowed',
  'network error',
  'timeout'
];

// List of status codes to silently ignore
const SILENT_STATUS_CODES = [404, 405, 0]; // 0 = Network errors

// Known endpoints that may return 404 normally (not errors)
const EXPECTED_404_PATTERNS = [
  '/api/auction-of-the-day',
  '/api/auctions/',
  '/api/user/avatar',
  '/api/notifications',
  '/api/autobidder/',
  '/api/promo-codes/',
  '/api/excitement/',
  '/api/gamification/'
];

/**
 * Check if an error should be silently ignored
 */
function shouldSilenceError(error) {
  const detail = error?.response?.data?.detail || '';
  const statusCode = error?.response?.status;
  const requestUrl = error?.config?.url || '';
  
  // Check if status code indicates silent error
  if (SILENT_STATUS_CODES.includes(statusCode)) {
    return true;
  }
  
  // Check if error message matches silent patterns
  const lowerDetail = detail.toLowerCase();
  if (SILENT_ERROR_PATTERNS.some(pattern => lowerDetail.includes(pattern))) {
    return true;
  }
  
  // Check if endpoint is expected to sometimes return 404
  if (EXPECTED_404_PATTERNS.some(pattern => requestUrl.includes(pattern))) {
    return true;
  }
  
  return false;
}

// Configure global response interceptor
axios.interceptors.response.use(
  // Success response - pass through
  (response) => response,
  
  // Error response - suppress toast for silent errors
  (error) => {
    if (shouldSilenceError(error)) {
      // Mark this error as silent
      error.isSilentError = true;
      error.suppressToast = true;
      
      // Clear the detail so components using `error.response?.data?.detail || 'fallback'`
      // will use the fallback instead of showing "Not Found"
      if (error.response?.data) {
        error.response.data._originalDetail = error.response.data.detail;
        error.response.data.detail = '';  // Empty string triggers fallback
      }
      
      // Only log unexpected 404s for debugging
      const requestUrl = error?.config?.url || '';
      const isExpected = EXPECTED_404_PATTERNS.some(p => requestUrl.includes(p));
      if (!isExpected && error?.response?.status === 404) {
        console.warn('[Axios] Unexpected 404:', requestUrl);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axios;
