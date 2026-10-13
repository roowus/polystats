import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Analytics from '@/components/Analytics';

function RouteProbe({ path }: { path: string }) {
  const location = useLocation();
  useEffect(() => {
    location.pathname = path;
  }, [path, location]);
  return null;
}

describe('Analytics', () => {
  it('pushes page_view with the current path into dataLayer', () => {
    const dataLayer: unknown[] = [];
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dataLayer;
    render(
      <MemoryRouter initialEntries={['/user/abc']}>
        <Analytics />
        <RouteProbe path="/user/abc" />
      </MemoryRouter>
    );
    const events = dataLayer.filter((e) => (e as { event?: string }).event === 'page_view');
    expect(events.length).toBeGreaterThan(0);
    expect((events[0] as { page_path?: string }).page_path).toBe('/user/abc');
  });
});
