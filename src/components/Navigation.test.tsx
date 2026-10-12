import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '@/components/Navigation';

describe('Navigation', () => {
  it('renders buttons for the main sections', () => {
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>
    );
    expect(screen.getByText('Polystats')).toBeInTheDocument();
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('User Stats')).toBeInTheDocument();
    expect(screen.getByText('Utils')).toBeInTheDocument();
  });
});
