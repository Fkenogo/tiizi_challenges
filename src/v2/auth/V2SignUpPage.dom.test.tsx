import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { V2SignUpPage } from './V2SignUpPage';

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    loginWithGoogle: h.loginWithGoogle,
    isAuthenticated: false,
    isReady: true,
  }),
}));

vi.mock('./v2EmailSignUp', () => ({
  v2EmailSignUp: h.signUp,
}));

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}{location.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <V2SignUpPage />
    </MemoryRouter>,
  );
}

const safeGroup = '/v2/groups/123e4567-e89b-42d3-a456-426614174000';
const encoded = encodeURIComponent(safeGroup);

beforeEach(() => {
  h.signUp.mockResolvedValue(undefined);
  h.loginWithGoogle.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('V2SignUpPage return path handling', () => {
  it('preserves a safe Group destination when switching to sign-in', () => {
    renderAt(`/v2/sign-up?next=${encoded}`);

    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'))
      .toBe(`/v2/sign-in?next=${encoded}`);
  });

  it.each([
    'https://evil.example/v2/today',
    ['/app', 'home'].join('/'),
    '/other',
  ])('falls back safely for an invalid or hostile destination: %s', (hostile) => {
    renderAt(`/v2/sign-up?next=${encodeURIComponent(hostile)}`);

    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'))
      .toBe('/v2/sign-in');
  });

  it('sends a successful new registration to Today even when next is a Group', async () => {
    renderAt(`/v2/sign-up?next=${encoded}`);

    await userEvent.type(screen.getByLabelText('Your name'), 'Test Member');
    await userEvent.type(screen.getByLabelText('Email address'), 'member@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/v2/today'));
    expect(h.signUp).toHaveBeenCalledWith('Test Member', 'member@example.com', 'secret1');
  });
});
