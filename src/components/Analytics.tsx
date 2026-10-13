import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Google Analytics for the SPA: pushes a page_view on every route change
 * (the gtag snippet in index.html only fires once on initial load).
 */
export default function Analytics() {
  const location = useLocation();

  useEffect(() => {
    const w = window as unknown as { dataLayer?: unknown[] };
    if (!w.dataLayer) return;
    w.dataLayer.push({
      event: 'page_view',
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location]);

  return null;
}
