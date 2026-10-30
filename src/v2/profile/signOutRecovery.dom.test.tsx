import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useV2SignOut } from './useV2SignOut';
import { readRecovery, writeRecovery } from '../operator/templates/templateDraftRecovery';
import { bodyFromContent } from '../operator/templates/templateAuthoringModel';
import { TEMPLATE_ID, TOKEN_A, contentOf } from '../operator/templates/testing/fixtures';

const h = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'author-1' }, logout: h.logout }) }));

const identity = { templateId: TEMPLATE_ID, version: 1 };
const record = { baseToken: TOKEN_A, baseBody: bodyFromContent(contentOf()), body: bodyFromContent(contentOf({ summary: 'Unsaved' })) };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

describe('sign-out clears Template draft recovery (even when the editor is not mounted)', () => {
  beforeEach(() => { sessionStorage.clear(); h.logout.mockReset(); });

  it('removes this account\'s records after a successful sign-out and leaves others alone', async () => {
    writeRecovery('author-1', identity, record); writeRecovery('author-1', 'new', record); writeRecovery('other', identity, record);
    h.logout.mockResolvedValue(undefined);
    const { result } = renderHook(() => useV2SignOut(), { wrapper });
    await result.current();
    expect(readRecovery('author-1', identity)).toBeNull();
    expect(readRecovery('author-1', 'new')).toBeNull();
    expect(readRecovery('other', identity)).not.toBeNull();
  });

  it('keeps the work when sign-out fails (the member is still signed in)', async () => {
    writeRecovery('author-1', identity, record);
    h.logout.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useV2SignOut(), { wrapper });
    await expect(result.current()).rejects.toThrow();
    expect(readRecovery('author-1', identity)).not.toBeNull();
  });
});
