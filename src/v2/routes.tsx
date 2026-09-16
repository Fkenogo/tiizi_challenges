import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/Auth/ProtectedRoute';
import { V2LocaleProvider } from './i18n/V2Locale';
import { V2GroupScope } from './group/V2GroupScope';
import { V2MemberShell } from './member/MemberShell';
import {
  V2ChallengesPage,
  V2GroupsPage,
  V2GuidePage,
  V2NotificationsPage,
  V2ProfilePage,
  V2TodayPage,
} from './member/memberPages';
import { V2OperatorShell } from './operator/OperatorShell';
import { V2OperatorPage } from './operator/operatorPages';

/**
 * TIIZI S1 — V2 composition root.
 *
 * Clearly separate V2 product root mounted at /v2/* — never nested
 * inside the V1 /app/* shell. Auth reuses the governed boundary
 * (ProtectedRoute, Class C) only: no V1 onboarding gating
 * (RequireOnboardedRoute / RequireProfileSetup), no group
 * prerequisite (RequireGroupRoute), no operator authority
 * (AdminRoute). Authenticated V2 entry lands in the new shell.
 *
 * Group context stays contextual: no global active-group state.
 * Detail routes (later slices) will wrap their screen in
 * V2GroupScope with the id from the route params.
 */

function V2Authenticated({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <V2LocaleProvider>
        <V2GroupScope groupId={null}>{children}</V2GroupScope>
      </V2LocaleProvider>
    </ProtectedRoute>
  );
}

export function V2Routes() {
  return (
    <V2Authenticated>
      <Routes>
        <Route element={<V2MemberShell />}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={<V2TodayPage />} />
          <Route path="challenges" element={<V2ChallengesPage />} />
          <Route path="groups" element={<V2GroupsPage />} />
          <Route path="guide" element={<V2GuidePage />} />
          <Route path="profile" element={<V2ProfilePage />} />
          <Route path="notifications" element={<V2NotificationsPage />} />
        </Route>
        <Route path="operator" element={<V2OperatorShell />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<V2OperatorPage section="overview" />} />
          <Route path="users" element={<V2OperatorPage section="users" />} />
          <Route path="groups" element={<V2OperatorPage section="groups" />} />
          <Route path="activities" element={<V2OperatorPage section="activities" />} />
          <Route path="challenges" element={<V2OperatorPage section="challenges" />} />
          <Route path="templates" element={<V2OperatorPage section="templates" />} />
          <Route path="review" element={<V2OperatorPage section="review" />} />
          <Route path="support" element={<V2OperatorPage section="support" />} />
          <Route path="content" element={<V2OperatorPage section="content" />} />
          <Route path="access" element={<V2OperatorPage section="access" />} />
          <Route path="health" element={<V2OperatorPage section="health" />} />
          <Route path="audit" element={<V2OperatorPage section="audit" />} />
          <Route path="settings" element={<V2OperatorPage section="settings" />} />
        </Route>
        <Route path="*" element={<Navigate to="today" replace />} />
      </Routes>
    </V2Authenticated>
  );
}
