import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTopOnNavigate - Automatically scrolls to top when route changes
 * This component should be placed inside BrowserRouter
 */
export const ScrollToTopOnNavigate = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top instantly when route changes
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};
