import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { V2LocaleProvider } from './i18n/V2Locale';
import { V2GroupScope } from './group/V2GroupScope';
import { V2Authenticated } from './auth/V2AuthGuard';
import { V2SignInPage } from './auth/V2SignInPage';
import { V2SignUpPage } from './auth/V2SignUpPage';
import { V2MemberShell } from './member/MemberShell';
import {
  V2GroupsPage,
  V2GuidePage,
  V2NotificationsPage,
  V2ProfilePage,
  V2TodayPage,
} from './member/memberPages';
import { V2OperatorShell } from './operator/OperatorShell';
import { V2OperatorPage } from './operator/operatorPages';
import { V2ChallengeListScreen } from './challenges/V2ChallengeListScreen';
import { V2ChallengeCreationWizard } from './challenges/V2ChallengeCreationWizard';
import { V2CreatedChallengeScreen } from './challenges/V2CreatedChallengeScreen';

/**
 * TIIZI S1 — V2 composition root (CORR-001: V2 owns its auth entry).
 *
 * Clearly separate V2 product root mounted at /v2/* — never nested
 * inside the V1 /app/* shell.
 *
 * - Public V2 auth experience: sign-in / sign-up (new V2 surfaces;
 *   no V1 login, sign-up, welcome, or onboarding composition).
 * - Authenticated V2 experience: V2Authenticated only checks the
 *   session and returns to the requested V2 route. No onboarding
 *   gating, no group prerequisite, no operator authority.
 * - Group context stays contextual: no global active-group state.
 *   Detail routes (later slices) will wrap their screen in
 *   V2GroupScope with the id from the route params.
 */

function V2ProtectedScope() {
  return (
    <V2Authenticated>
      <V2GroupScope groupId={null}>
        <Outlet />
      </V2GroupScope>
    </V2Authenticated>
  );
}

export function V2Routes() {
  return (
    <V2LocaleProvider>
      <Routes>
        <Route path="sign-in" element={<V2SignInPage />} />
        <Route path="sign-up" element={<V2SignUpPage />} />
        <Route element={<V2ProtectedScope />}>
          <Route element={<V2MemberShell />}>
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={<V2TodayPage />} />
            <Route path="challenges" element={<V2ChallengeListScreen />} />
            <Route path="challenges/new" element={<V2ChallengeCreationWizard />} />
            <Route path="challenges/:challengeId" element={<V2CreatedChallengeScreen />} />
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
        </Route>
        <Route path="*" element={<Navigate to="today" replace />} />
      </Routes>
    </V2LocaleProvider>
  );
}
