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

// Configure global response interceptor
axios.interceptors.response.use(
  // Success response - pass through
  (response) => response,
  
  // Error response - modify error detail if it's a silent error
  (error) => {
    const detail = error?.response?.data?.detail;
    const statusCode = error?.response?.status;
    
    // Check if error should be silent (by status code or message)
    const isSilentByStatus = SILENT_STATUS_CODES.includes(statusCode);
    const isSilentByMessage = detail && SILENT_ERRORS.some(e => 
      detail.toLowerCase().includes(e.toLowerCase())
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
      console.log(`Suppressed error [${statusCode}]:`, detail || 'No detail');
    }
    
    return Promise.reject(error);
  }
);

export default axios;
