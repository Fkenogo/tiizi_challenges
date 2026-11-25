import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { V2WelcomeSlides } from '../welcome/V2WelcomeSlides';

let mockAuth = { isAuthenticated: false, isReady: true };

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

function LocationEcho({ label }: { label: string }) {
  const loc = useLocation();
  return <div data-testid="dest">{`${label}:${loc.pathname}${loc.search}`}</div>;
}

describe('V2 returning-member landing & welcome exits', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    mockAuth = { isAuthenticated: false, isReady: true };
  });

  it('routes signed-in returning members skipping welcome to /v2/today rather than /v2/profile', () => {
    mockAuth = { isAuthenticated: true, isReady: true };
    render(
      <MemoryRouter initialEntries={['/v2/welcome']}>
        <Routes>
          <Route path="/v2/welcome" element={<V2WelcomeSlides />} />
          <Route path="/v2/today" element={<LocationEcho label="today" />} />
          <Route path="/v2/profile" element={<LocationEcho label="profile" />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Close|Skip/i }));
    expect(screen.getByTestId('dest').textContent).toBe('today:/v2/today');
  });

  it('preserves explicit deep-link ?next=/v2/groups/g1 when signed-in member finishes welcome', () => {
    mockAuth = { isAuthenticated: true, isReady: true };
    render(
      <MemoryRouter initialEntries={['/v2/welcome?next=%2Fv2%2Fgroups%2Fg1']}>
        <Routes>
          <Route path="/v2/welcome" element={<V2WelcomeSlides />} />
          <Route path="/v2/groups/:id" element={<LocationEcho label="group" />} />
          <Route path="/v2/profile" element={<LocationEcho label="profile" />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Close|Skip/i }));
    expect(screen.getByTestId('dest').textContent).toBe('group:/v2/groups/g1');
  });

  it('returns to /v2/profile when welcome was explicitly replayed from Profile (?next=/v2/profile)', () => {
    mockAuth = { isAuthenticated: true, isReady: true };
    render(
      <MemoryRouter initialEntries={['/v2/welcome?next=%2Fv2%2Fprofile']}>
        <Routes>
          <Route path="/v2/welcome" element={<V2WelcomeSlides />} />
          <Route path="/v2/profile" element={<LocationEcho label="profile" />} />
        </Routes>
      </MemoryRouter>,
    );

    // Jump to final slide (slide 4) to verify the primary exit link
    fireEvent.click(screen.getByRole('button', { name: /Go to slide 4/i }));
    const backLink = screen.getByRole('link', { name: 'Back to your profile' });
    expect(backLink.getAttribute('href')).toBe('/v2/profile');
  });
});
