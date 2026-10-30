import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECOVERY_TTL_MS, clearAccountRecovery, clearRecovery, purgeOtherAccountsRecovery, readRecovery, recoveryKey, writeRecovery,
} from './templateDraftRecovery';
import { bodyFromContent } from './templateAuthoringModel';
import { TEMPLATE_ID, TOKEN_A, contentOf } from './testing/fixtures';

const draft = { templateId: TEMPLATE_ID, version: 1 };
const record = { baseToken: TOKEN_A, baseBody: bodyFromContent(contentOf()), body: bodyFromContent(contentOf({ summary: 'Edited' })) };

describe('Template draft recovery', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips within the time bound', () => {
    writeRecovery('u1', draft, record, 1000);
    expect(readRecovery('u1', draft, 1000 + RECOVERY_TTL_MS - 1)?.body.summary).toBe('Edited');
  });

  it('expires after the bound and removes the record', () => {
    writeRecovery('u1', draft, record, 1000);
    expect(readRecovery('u1', draft, 1000 + RECOVERY_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem(recoveryKey('u1', draft))).toBeNull();
  });

  it('is scoped to the account and the draft identity', () => {
    writeRecovery('u1', draft, record);
    expect(readRecovery('u2', draft)).toBeNull();
    expect(readRecovery('u1', { templateId: TEMPLATE_ID, version: 2 })).toBeNull();
    expect(readRecovery('u1', 'new')).toBeNull();
  });

  it('stores no credential: only content and the content-hash base token', () => {
    writeRecovery('u1', draft, record);
    const raw = sessionStorage.getItem(recoveryKey('u1', draft)) as string;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['baseBody', 'baseToken', 'body', 'savedAt']);
    expect(raw).not.toMatch(/bearer|idToken|password|authorization/i);
  });

  it('discards corrupt records instead of throwing', () => {
    sessionStorage.setItem(recoveryKey('u1', draft), '{not json');
    expect(readRecovery('u1', draft)).toBeNull();
    sessionStorage.setItem(recoveryKey('u1', draft), JSON.stringify({ savedAt: Date.now(), body: { composer: {} } }));
    expect(readRecovery('u1', draft)).toBeNull();
  });

  it('clears one draft, one account, and every other account', () => {
    writeRecovery('u1', draft, record); writeRecovery('u1', 'new', record); writeRecovery('u2', draft, record);
    clearRecovery('u1', draft);
    expect(readRecovery('u1', draft)).toBeNull();
    expect(readRecovery('u1', 'new')).not.toBeNull();
    purgeOtherAccountsRecovery('u1');
    expect(readRecovery('u2', draft)).toBeNull();
    expect(readRecovery('u1', 'new')).not.toBeNull();
    clearAccountRecovery('u1');
    expect(readRecovery('u1', 'new')).toBeNull();
  });

  it('does not touch unrelated session storage', () => {
    sessionStorage.setItem('tiizi:other', 'keep');
    writeRecovery('u1', draft, record); clearAccountRecovery('u1'); purgeOtherAccountsRecovery('u9');
    expect(sessionStorage.getItem('tiizi:other')).toBe('keep');
  });
});
