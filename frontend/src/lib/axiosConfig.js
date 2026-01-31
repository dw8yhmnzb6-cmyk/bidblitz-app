/**
 * Axios configuration with global error handling
 * Prevents "Not Found" and similar technical errors from being shown to users
 */
import axios from 'axios';

// List of error messages that should be silently ignored
const SILENT_ERRORS = [
  'not found',
  'Not found', 
  'NOT FOUND',
  'User not found',
  'user not found',
  'Auction not found',
  'Product not found',
  'Resource not found',
  'Method Not Allowed'
];

// List of status codes to silently ignore
const SILENT_STATUS_CODES = [404, 405];

// Known endpoints that may return 404 normally (not errors)
const EXPECTED_404_PATTERNS = [
  '/api/auction-of-the-day',  // May not exist
  '/api/auctions/',            // Auction may have ended
  '/api/user/avatar',          // User may not have avatar
  '/api/notifications',        // May have no notifications
];

// Configure global response interceptor
axios.interceptors.response.use(
  // Success response - pass through
  (response) => response,
  
  // Error response - modify error detail if it's a silent error
  (error) => {
    const detail = error?.response?.data?.detail;
    const statusCode = error?.response?.status;
    const requestUrl = error?.config?.url || 'unknown';
    const method = error?.config?.method?.toUpperCase() || 'GET';
    
    // Check if error should be silent (by status code or message)
    const isSilentByStatus = SILENT_STATUS_CODES.includes(statusCode);
    const isSilentByMessage = detail && SILENT_ERRORS.some(e => 
      detail.toLowerCase().includes(e.toLowerCase())
    );
    const isExpected404 = EXPECTED_404_PATTERNS.some(pattern => 
      requestUrl.includes(pattern)
    );
    
    if (isSilentByStatus || isSilentByMessage) {
      // Mark this error as silent
      error.isSilentError = true;
      // Change the detail to null so toast.error won't show it
      if (error.response?.data) {
        error.response.data.originalDetail = detail;
        error.response.data.detail = null;
      }
      // Prevent default toast behavior by setting a flag
      error.suppressToast = true;
      
      // Log with more detail to help debug
      if (!isExpected404) {
        console.warn(`[404 DEBUG] ${method} ${requestUrl}`, {
          status: statusCode,
          detail: detail,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return Promise.reject(error);
  }
);

export default axios;
