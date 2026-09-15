import { describe, expect, it } from 'vitest';
import { resolveV2ComponentPreviewEnabled } from './v2ComponentPreviewMode.js';

describe('V2 component preview mode', () => {
  it('enables only an explicit development preview', () => {
    expect(resolveV2ComponentPreviewEnabled({ DEV: true, VITE_TIIZI_V2_COMPONENT_PREVIEW: 'true' })).toBe(true);
    expect(resolveV2ComponentPreviewEnabled({ DEV: false, VITE_TIIZI_V2_COMPONENT_PREVIEW: 'true' })).toBe(false);
    expect(resolveV2ComponentPreviewEnabled({ DEV: true, VITE_TIIZI_V2_COMPONENT_PREVIEW: 'false' })).toBe(false);
  });
});
