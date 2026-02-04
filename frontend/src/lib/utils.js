import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Parse API error and return user-friendly German message
 * This helps avoid showing raw "Not Found" or technical errors to users
 * Works together with axiosConfig.js interceptor
 */
export function getErrorMessage(error, fallback = 'Ein Fehler ist aufgetreten') {
  // If error was already marked as silent by interceptor, skip toast
  if (error?.isSilentError || error?.suppressToast) {
    return null;
  }
  
  const detail = error?.response?.data?.detail;
  
  // If no detail or empty string, use fallback
  if (!detail) return fallback;
  
  // Additional check for silent error patterns (backup for interceptor)
  const silentPatterns = [
    'not found',
    'method not allowed',
    'network error'
  ];
  
  const lowerDetail = detail.toLowerCase();
  if (silentPatterns.some(p => lowerDetail.includes(p))) {
    return null; // Return null to indicate "don't show toast"
  }
  
  return detail;
}

/**
 * Show error toast only if the error is not silent
 */
export function showErrorToast(error, fallback = 'Fehler') {
  const message = getErrorMessage(error, fallback);
  if (message) {
    const { toast } = require('sonner');
    toast.error(message);
  }
}
