/** Local development-only gate for the PF-05 component review route. */
export interface V2ComponentPreviewEnvironment {
  DEV?: boolean;
  VITE_TIIZI_V2_COMPONENT_PREVIEW?: string;
}

export function resolveV2ComponentPreviewEnabled(env: V2ComponentPreviewEnvironment): boolean {
  return env.DEV === true
    && env.VITE_TIIZI_V2_COMPONENT_PREVIEW?.trim().toLowerCase() === 'true';
}

export function isV2ComponentPreviewEnabled(): boolean {
  if (typeof import.meta === 'undefined' || !import.meta.env) return false;
  return resolveV2ComponentPreviewEnabled(import.meta.env as V2ComponentPreviewEnvironment);
}
