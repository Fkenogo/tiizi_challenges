import { createContext, useContext } from 'react';

/**
 * TIIZI S1 — contextual Group scope.
 *
 * Group context stays contextual: screens that deal with one group
 * receive its id from the route (e.g. /v2/groups/:groupId) through
 * this scope. There is deliberately NO global workspace-style
 * active-group state and no V1 group-prerequisite flow.
 */

type V2GroupScopeValue = { groupId: string | null };

const V2GroupScopeContext = createContext<V2GroupScopeValue>({ groupId: null });

export function V2GroupScope({
  groupId,
  children,
}: {
  groupId: string | null;
  children: React.ReactNode;
}) {
  return (
    <V2GroupScopeContext.Provider value={{ groupId }}>
      {children}
    </V2GroupScopeContext.Provider>
  );
}

/** Returns the contextual group id, or null when the surface is not group-scoped. */
export function useV2GroupId(): string | null {
  return useContext(V2GroupScopeContext).groupId;
}
