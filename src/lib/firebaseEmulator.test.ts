import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  connectFirestoreEmulator: vi.fn(),
}));

import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import {
  configureFirebaseEmulators,
  resetFirebaseEmulatorConnectionsForTests,
  shouldUseFirebaseEmulators,
} from './firebaseEmulator';

const mockConnectAuthEmulator = vi.mocked(connectAuthEmulator);
const mockConnectFirestoreEmulator = vi.mocked(connectFirestoreEmulator);

describe('local Firebase emulator wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseEmulatorConnectionsForTests();
  });

  it('does not connect either service while the emulator flag is off', () => {
    configureFirebaseEmulators({} as never, {} as never, false);

    expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
    expect(mockConnectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('requires both the explicit flag and a development build', () => {
    expect(shouldUseFirebaseEmulators('true', true)).toBe(true);
    expect(shouldUseFirebaseEmulators('false', true)).toBe(false);
    expect(shouldUseFirebaseEmulators('true', false)).toBe(false);
  });

  it('connects Auth to the local Auth emulator while the flag is on', () => {
    configureFirebaseEmulators({} as never, {} as never, true);

    expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
      expect.anything(),
      'http://127.0.0.1:9099',
      { disableWarnings: true },
    );
  });

  it('connects Firestore to the local Firestore emulator while the flag is on', () => {
    configureFirebaseEmulators({} as never, {} as never, true);

    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(
      expect.anything(),
      '127.0.0.1',
      8080,
    );
  });

  it('connects each Firebase service only once for the same initialized client', () => {
    const auth = {} as never;
    const firestore = {} as never;

    configureFirebaseEmulators(auth, firestore, true);
    configureFirebaseEmulators(auth, firestore, true);

    expect(mockConnectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledTimes(1);
  });
});
