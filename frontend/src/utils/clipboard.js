/**
 * Safe clipboard utility that works on all devices including iOS Safari
 * Falls back to execCommand for older browsers
 */
export const safeCopyToClipboard = async (text) => {
  try {
    // Modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // Clipboard API failed, try fallback
    console.warn('Clipboard API failed, trying fallback:', err);
  }
  
  // Fallback method using execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Prevent scrolling to bottom
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // For iOS devices
    textArea.setSelectionRange(0, text.length);
    
    const result = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return result;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
};
