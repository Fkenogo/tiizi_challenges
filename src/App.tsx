import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { mockupAliases } from './data/mockupAliases';
import { AuthProvider } from './context/AuthContext';
import { RequireOnboardedRoute } from './components/Auth/RequireOnboardedRoute';
import { RequireOnboardingRoute } from './components/Auth/RequireOnboardingRoute';
import { AdminRoute } from './components/Auth/AdminRoute';
import { RequireGroupRoute } from './components/Auth/RequireGroupRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import { LoadingSpinner } from './components/Mobile';
import { useAuth } from './hooks/useAuth';
import { dailyGoalsService } from './services/dailyGoalsService';
import { groupService } from './services/groupService';
import { challengeService } from './services/challengeService';

const ExerciseLibraryScreen = lazy(() => import('./features/Exercises/ExerciseLibraryScreen'));
const WellnessActivitiesLibraryScreen = lazy(() => import('./features/Wellness/WellnessActivitiesLibraryScreen'));
const WellnessActivityDetailScreen = lazy(() => import('./features/Wellness/WellnessActivityDetailScreen'));
const ExerciseDetailScreen = lazy(() => import('./features/Exercises/ExerciseDetailScreen'));
const LogWorkoutScreen = lazy(() => import('./features/Workouts/LogWorkoutScreen'));
const LogWellnessActivityScreen = lazy(() => import('./features/Workouts/LogWellnessActivityScreen'));
const SelectChallengeActivityScreen = lazy(() => import('./features/Workouts/SelectChallengeActivityScreen'));
const ChooseChallengeToLogScreen = lazy(() => import('./features/Workouts/ChooseChallengeToLogScreen'));
const WorkoutLoggedScreen = lazy(() => import('./features/Workouts/WorkoutLoggedScreen'));
const HomeScreen = lazy(() => import('./features/Home/HomeScreen'));
const GroupsScreen = lazy(() => import('./features/Groups/GroupsScreen'));
const ChallengesScreen = lazy(() => import('./features/Challenges/ChallengesScreen'));
const ChallengeDetailScreen = lazy(() => import('./features/Challenges/ChallengeDetailScreen'));
const CreateChallengeWizard = lazy(() => import('./features/Challenges/CreateChallengeWizard'));
const SuggestedChallengesScreen = lazy(() => import('./features/Challenges/SuggestedChallengesScreen'));
const WellnessTemplateGalleryScreen = lazy(() => import('./features/Challenges/WellnessTemplateGalleryScreen'));
const WellnessTemplateDetailScreen = lazy(() => import('./features/Challenges/WellnessTemplateDetailScreen'));
const BrowseChallengesScreen = lazy(() => import('./features/Challenges/BrowseChallengesScreen'));
const ChallengePreviewScreen = lazy(() => import('./features/Challenges/ChallengePreviewScreen'));
const CompetitiveChallengeScreen = lazy(() => import('./features/Challenges/CompetitiveChallengeScreen'));
const CollectiveChallengeScreen = lazy(() => import('./features/Challenges/CollectiveChallengeScreen'));
const StreakChallengeScreen = lazy(() => import('./features/Challenges/StreakChallengeScreen'));
const ChallengeLeaderboardScreen = lazy(() => import('./features/Challenges/ChallengeLeaderboardScreen'));
const ChallengeCompletedScreen = lazy(() => import('./features/Challenges/ChallengeCompletedScreen'));
const CompletedChallengesScreen = lazy(() => import('./features/Challenges/CompletedChallengesScreen'));
const ProfileScreen = lazy(() => import('./features/Profile/ProfileScreen'));
const EditProfileScreen = lazy(() => import('./features/Profile/EditProfileScreen'));
const EditGroupScreen = lazy(() => import('./features/Groups/EditGroupScreen'));
const ProfileSettingsScreen = lazy(() => import('./features/Profile/ProfileSettingsScreen'));
const ProfileAnalyticsScreen = lazy(() => import('./features/Profile/ProfileAnalyticsScreen'));
const ProfilePersonalInfoScreen = lazy(() => import('./features/Profile/ProfilePersonalInfoScreen'));
const ProfilePrivacySettingsScreen = lazy(() => import('./features/Profile/ProfilePrivacySettingsScreen'));
const ProfileCompletionScreen = lazy(() => import('./features/Profile/ProfileCompletionScreen'));
const ProfileInterestsScreen = lazy(() => import('./features/Profile/ProfileInterestsScreen'));
const ProfileSetupFinishScreen = lazy(() => import('./features/Profile/ProfileSetupFinishScreen'));
const ProfileWellnessInterestsScreen = lazy(() => import('./features/Profile/ProfileWellnessInterestsScreen'));
const ProfileHealthGoalsScreen = lazy(() => import('./features/Profile/ProfileHealthGoalsScreen'));
const OnboardingSlides = lazy(() => import('./features/Onboarding/OnboardingSlides'));
const LearnTiiziScreen = lazy(() => import('./features/Profile/LearnTiiziScreen'));
const LoginScreen = lazy(() => import('./features/Auth/LoginScreen'));
const SignupScreen = lazy(() => import('./features/Auth/SignupScreen'));
const InstallScreen = lazy(() => import('./features/Install/InstallScreen'));
const TermsScreen = lazy(() => import('./features/Legal/TermsScreen'));
const PrivacyScreen = lazy(() => import('./features/Legal/PrivacyScreen'));
const NotFoundScreen = lazy(() => import('./features/NotFound/NotFoundScreen'));
const GroupDetailScreen = lazy(() => import('./features/Groups/GroupDetailScreen'));
const GroupFeedScreen = lazy(() => import('./features/Groups/GroupFeedScreen'));
const GroupMembersScreen = lazy(() => import('./features/Groups/GroupMembersScreen'));
const GroupLeaderboardScreen = lazy(() => import('./features/Groups/GroupLeaderboardScreen'));
const GroupChallengesHighlightedScreen = lazy(() => import('./features/Groups/GroupChallengesHighlightedScreen'));
const CreateGroupScreen = lazy(() => import('./features/Groups/CreateGroupScreen'));
const JoinGroupScreen = lazy(() => import('./features/Groups/JoinGroupScreen'));
const MockupCatalogScreen = lazy(() => import('./features/Mockups/MockupCatalogScreen'));
const MockupScreen = lazy(() => import('./features/Mockups/MockupScreen'));
const FlowHubScreen = lazy(() => import('./features/Flows/FlowHubScreen'));
const QuickActionsScreen = lazy(() => import('./features/QuickActions/QuickActionsScreen'));
const NotificationsScreen = lazy(() => import('./features/Notifications/NotificationsScreen'));
const HelpScreen = lazy(() => import('./features/Help/HelpScreen'));
const ShareScreen = lazy(() => import('./features/Share/ShareScreen'));
const WelcomeScreen = lazy(() => import('./features/Welcome/WelcomeScreen'));
const AdminPendingChallengesScreen = lazy(() => import('./features/Admin/AdminPendingChallengesScreen'));
const AdminApprovedChallengesScreen = lazy(() => import('./features/Admin/AdminApprovedChallengesScreen'));
const AdminDashboardScreen = lazy(() => import('./features/Admin/Dashboard/AdminDashboardScreen'));
const AdminModulePlaceholderScreen = lazy(() => import('./features/Admin/AdminModulePlaceholderScreen'));
const AdminExerciseListScreen = lazy(() => import('./features/Admin/Exercises/ExerciseListScreen'));
const AdminAddExerciseScreen = lazy(() => import('./features/Admin/Exercises/AddExerciseScreen'));
const AdminEditExerciseScreen = lazy(() => import('./features/Admin/Exercises/EditExerciseScreen'));
const AdminBulkImportScreen = lazy(() => import('./features/Admin/Exercises/BulkImportScreen'));
const AdminExerciseStatsScreen = lazy(() => import('./features/Admin/Exercises/ExerciseStatsScreen'));
const AdminWellnessActivityListScreen = lazy(() => import('./features/Admin/Wellness/WellnessActivityListScreen'));
const AdminAddWellnessActivityScreen = lazy(() => import('./features/Admin/Wellness/AddWellnessActivityScreen'));
const AdminEditWellnessActivityScreen = lazy(() => import('./features/Admin/Wellness/EditWellnessActivityScreen'));
const AdminUserListScreen = lazy(() => import('./features/Admin/Users/UserListScreen'));
const AdminUserDetailScreen = lazy(() => import('./features/Admin/Users/UserDetailScreen'));
const AdminUserAnalyticsScreen = lazy(() => import('./features/Admin/Users/UserAnalyticsScreen'));
const AdminSupportTicketsScreen = lazy(() => import('./features/Admin/Users/SupportTicketsScreen'));
const AdminGroupListScreen = lazy(() => import('./features/Admin/Groups/GroupListScreen'));
const AdminGroupDetailScreen = lazy(() => import('./features/Admin/Groups/GroupDetailScreen'));
const AdminGroupModerationScreen = lazy(() => import('./features/Admin/Groups/GroupModerationScreen'));
const AdminAnalyticsOverviewScreen = lazy(() => import('./features/Admin/Analytics/OverviewScreen'));
const AdminAnalyticsUserGrowthScreen = lazy(() => import('./features/Admin/Analytics/UserGrowthScreen'));
const AdminAnalyticsEngagementScreen = lazy(() => import('./features/Admin/Analytics/EngagementScreen'));
const AdminAnalyticsRevenueScreen = lazy(() => import('./features/Admin/Analytics/RevenueScreen'));
const AdminChallengeTemplatesScreen = lazy(() => import('./features/Admin/Challenges/ChallengeTemplatesScreen'));
const AdminActiveChallengesScreen = lazy(() => import('./features/Admin/Challenges/ActiveChallengesScreen'));
const AdminChallengeDetailScreen = lazy(() => import('./features/Admin/Challenges/AdminChallengeDetailScreen').then((m) => ({ default: m.AdminChallengeDetailScreen })));
const AdminCreateChallengeScreen = lazy(() => import('./features/Admin/Challenges/CreateChallengeScreen'));
const AdminEditChallengeTemplateScreen = lazy(() => import('./features/Admin/Challenges/EditChallengeTemplateScreen'));
const AdminEditWellnessTemplateScreen = lazy(() => import('./features/Admin/Challenges/EditWellnessTemplateScreen'));
const AdminChallengeAnalyticsScreen = lazy(() => import('./features/Admin/Challenges/ChallengeAnalyticsScreen'));
const DonationCampaignsScreen = lazy(() => import('./features/Admin/Donations/DonationCampaignsScreen'));
const DonationListScreen = lazy(() => import('./features/Admin/Donations/DonationListScreen'));
const DonationReportsScreen = lazy(() => import('./features/Admin/Donations/DonationReportsScreen'));
const InterestsGoalsScreen = lazy(() => import('./features/Admin/Content/InterestsGoalsScreen'));
const OnboardingContentScreen = lazy(() => import('./features/Admin/Content/OnboardingContentScreen'));
const AdminNotificationsScreen = lazy(() => import('./features/Admin/Content/NotificationsScreen'));
const AdminContentPagesScreen = lazy(() => import('./features/Admin/Content/ContentPagesScreen'));
const AppSettingsScreen = lazy(() => import('./features/Admin/Settings/AppSettingsScreen'));
const AdminUsersSettingsScreen = lazy(() => import('./features/Admin/Settings/AdminUsersScreen'));
const SystemLogsScreen = lazy(() => import('./features/Admin/Settings/SystemLogsScreen'));
const DonateScreen = lazy(() => import('./features/Donate/DonateScreen'));
const BooksLibraryScreen = lazy(() => import('./features/Library/BooksLibraryScreen'));
const BookReaderScreen = lazy(() => import('./features/Library/BookReaderScreen'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const code = String((error as { code?: string } | null)?.code ?? '');
        if (
          code.includes('permission-denied')
          || code.includes('unauthenticated')
          || code.includes('failed-precondition')
        ) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 5 * 60 * 1000,
    },
  },
});

function RouteViewportMode() {
  const location = useLocation();

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/app/admin');
    document.body.classList.toggle('admin-desktop', isAdminRoute);
    return () => {
      document.body.classList.remove('admin-desktop');
    };
  }, [location.pathname]);

  return null;
}

function RouteWarmup() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Warm up high-traffic chunks after authentication to improve first navigation latency.
    void import('./features/Home/HomeScreen');
    void import('./features/Groups/GroupsScreen');
    void import('./features/Challenges/ChallengesScreen');
    void import('./features/Challenges/ChallengeDetailScreen');

    if (!user?.uid) return;
    void queryClient.prefetchQuery({
      queryKey: ['daily-goals', user.uid],
      queryFn: () => dailyGoalsService.getTodayGoals(user.uid),
      staleTime: 2 * 60 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ['my-groups', user.uid],
      queryFn: () => groupService.getMyGroups(user.uid),
      staleTime: 2 * 60 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ['challenges', user.uid],
      queryFn: () => challengeService.getUserAccessibleChallenges(user.uid),
      staleTime: 5 * 60 * 1000,
    });
  }, [isAuthenticated, queryClient, user?.uid]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <RouteViewportMode />
            <RouteWarmup />
            <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner fullScreen label="Loading screen..." />}>
              <Routes>
                {import.meta.env.DEV && <Route path="/mockups" element={<MockupCatalogScreen />} />}
                {import.meta.env.DEV && <Route path="/mockups/:slug" element={<MockupScreen />} />}

                {import.meta.env.DEV && mockupAliases.map((alias) => (
                  <Route
                    key={alias.path}
                    path={alias.path}
                    element={<MockupScreen slugOverride={alias.slug} />}
                  />
                ))}

                <Route path="/install" element={<InstallScreen />} />
                <Route path="/terms" element={<TermsScreen />} />
                <Route path="/privacy" element={<PrivacyScreen />} />
                <Route path="/app/login" element={<LoginScreen />} />
                <Route path="/app/signup" element={<SignupScreen />} />
                <Route path="/app/flow" element={<RequireOnboardedRoute><FlowHubScreen /></RequireOnboardedRoute>} />
                <Route path="/app/quick-actions" element={<RequireOnboardedRoute><QuickActionsScreen /></RequireOnboardedRoute>} />
                <Route path="/app/welcome" element={<WelcomeScreen />} />
                <Route path="/app/notifications" element={<RequireOnboardedRoute><NotificationsScreen /></RequireOnboardedRoute>} />
                <Route path="/app/help" element={<RequireOnboardedRoute><HelpScreen /></RequireOnboardedRoute>} />
                <Route path="/app/share" element={<RequireOnboardedRoute><ShareScreen /></RequireOnboardedRoute>} />
                <Route path="/app/donate" element={<RequireOnboardedRoute><DonateScreen /></RequireOnboardedRoute>} />
                <Route path="/app/library" element={<RequireOnboardedRoute><BooksLibraryScreen /></RequireOnboardedRoute>} />
                <Route path="/app/library/:id" element={<RequireOnboardedRoute><BookReaderScreen /></RequireOnboardedRoute>} />
                <Route path="/app/admin/dashboard" element={<AdminRoute><AdminDashboardScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/pending" element={<AdminRoute><AdminPendingChallengesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/approved" element={<AdminRoute><AdminApprovedChallengesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/templates" element={<AdminRoute><AdminChallengeTemplatesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/templates/:id/edit" element={<AdminRoute><AdminEditChallengeTemplateScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/wellness-templates/:id/edit" element={<AdminRoute><AdminEditWellnessTemplateScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/active" element={<AdminRoute><AdminActiveChallengesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/:id" element={<AdminRoute><AdminChallengeDetailScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/create" element={<AdminRoute><AdminCreateChallengeScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/analytics" element={<AdminRoute><AdminChallengeAnalyticsScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises" element={<AdminRoute><AdminExerciseListScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/add" element={<AdminRoute><AdminAddExerciseScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/:id/edit" element={<AdminRoute><AdminEditExerciseScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/import" element={<AdminRoute><AdminBulkImportScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/stats" element={<AdminRoute><AdminExerciseStatsScreen /></AdminRoute>} />
                <Route path="/app/admin/wellness-activities" element={<AdminRoute><AdminWellnessActivityListScreen /></AdminRoute>} />
                <Route path="/app/admin/wellness-activities/add" element={<AdminRoute><AdminAddWellnessActivityScreen /></AdminRoute>} />
                <Route path="/app/admin/wellness-activities/:id/edit" element={<AdminRoute><AdminEditWellnessActivityScreen /></AdminRoute>} />
                <Route path="/app/admin/users" element={<AdminRoute><AdminUserListScreen /></AdminRoute>} />
                <Route path="/app/admin/users/:uid" element={<AdminRoute><AdminUserDetailScreen /></AdminRoute>} />
                <Route path="/app/admin/users/analytics" element={<AdminRoute><AdminUserAnalyticsScreen /></AdminRoute>} />
                <Route path="/app/admin/users/support-tickets" element={<AdminRoute><AdminSupportTicketsScreen /></AdminRoute>} />
                <Route path="/app/admin/groups" element={<AdminRoute><AdminGroupListScreen /></AdminRoute>} />
                <Route path="/app/admin/groups/:id" element={<AdminRoute><AdminGroupDetailScreen /></AdminRoute>} />
                <Route path="/app/admin/groups/moderation" element={<AdminRoute><AdminGroupModerationScreen /></AdminRoute>} />
                <Route path="/app/admin/donations/campaigns" element={<AdminRoute><DonationCampaignsScreen /></AdminRoute>} />
                <Route path="/app/admin/donations/transactions" element={<AdminRoute><DonationListScreen /></AdminRoute>} />
                <Route path="/app/admin/donations/reports" element={<AdminRoute><DonationReportsScreen /></AdminRoute>} />
                <Route path="/app/admin/content/interests-goals" element={<AdminRoute><InterestsGoalsScreen /></AdminRoute>} />
                <Route path="/app/admin/content/onboarding" element={<AdminRoute><OnboardingContentScreen /></AdminRoute>} />
                <Route path="/app/admin/content/notifications" element={<AdminRoute><AdminNotificationsScreen /></AdminRoute>} />
                <Route path="/app/admin/content/pages" element={<AdminRoute><AdminContentPagesScreen /></AdminRoute>} />
                <Route path="/app/admin/content/books" element={<Navigate to="/app/admin/content/pages" replace />} />
                <Route path="/app/admin/analytics" element={<AdminRoute><AdminAnalyticsOverviewScreen /></AdminRoute>} />
                <Route path="/app/admin/analytics/user-growth" element={<AdminRoute><AdminAnalyticsUserGrowthScreen /></AdminRoute>} />
                <Route path="/app/admin/analytics/engagement" element={<AdminRoute><AdminAnalyticsEngagementScreen /></AdminRoute>} />
                <Route path="/app/admin/analytics/revenue" element={<AdminRoute><AdminAnalyticsRevenueScreen /></AdminRoute>} />
                <Route path="/app/admin/settings" element={<AdminRoute><AppSettingsScreen /></AdminRoute>} />
                <Route path="/app/admin/settings/admin-users" element={<AdminRoute><AdminUsersSettingsScreen /></AdminRoute>} />
                <Route path="/app/admin/settings/logs" element={<AdminRoute><SystemLogsScreen /></AdminRoute>} />
                <Route path="/app/home" element={<RequireOnboardedRoute><HomeScreen /></RequireOnboardedRoute>} />
                <Route path="/app/exercises" element={<RequireOnboardedRoute><ExerciseLibraryScreen /></RequireOnboardedRoute>} />
                <Route path="/app/wellness-activities" element={<RequireOnboardedRoute><WellnessActivitiesLibraryScreen /></RequireOnboardedRoute>} />
                <Route path="/app/wellness-activities/:id" element={<RequireOnboardedRoute><WellnessActivityDetailScreen /></RequireOnboardedRoute>} />
                <Route path="/app/exercises/:id" element={<RequireOnboardedRoute><ExerciseDetailScreen /></RequireOnboardedRoute>} />
                <Route path="/app/workouts/log" element={<RequireOnboardedRoute><RequireGroupRoute><LogWorkoutScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/workouts/log-wellness" element={<RequireOnboardedRoute><RequireGroupRoute><LogWellnessActivityScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/workouts/select-activity" element={<RequireOnboardedRoute><RequireGroupRoute><SelectChallengeActivityScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/workouts/choose-challenge" element={<RequireOnboardedRoute><ChooseChallengeToLogScreen /></RequireOnboardedRoute>} />
                <Route path="/app/workouts/success" element={<RequireOnboardedRoute><RequireGroupRoute><WorkoutLoggedScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/groups" element={<RequireOnboardedRoute><GroupsScreen /></RequireOnboardedRoute>} />
                <Route path="/app/group/:id" element={<RequireOnboardedRoute><GroupDetailScreen /></RequireOnboardedRoute>} />
                <Route path="/app/group/:id/edit" element={<RequireOnboardedRoute><EditGroupScreen /></RequireOnboardedRoute>} />
                <Route path="/app/group/:id/feed" element={<RequireOnboardedRoute><GroupFeedScreen /></RequireOnboardedRoute>} />
                <Route path="/app/group/:id/members" element={<RequireOnboardedRoute><GroupMembersScreen /></RequireOnboardedRoute>} />
                <Route path="/app/group/:id/leaderboard" element={<RequireOnboardedRoute><GroupLeaderboardScreen /></RequireOnboardedRoute>} />
                <Route path="/app/group/:id/challenges/highlighted" element={<RequireOnboardedRoute><GroupChallengesHighlightedScreen /></RequireOnboardedRoute>} />
                <Route path="/app/create-group" element={<RequireOnboardedRoute><CreateGroupScreen /></RequireOnboardedRoute>} />
                <Route path="/app/join-group" element={<RequireOnboardedRoute><JoinGroupScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenges" element={<RequireOnboardedRoute><ChallengesScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenges/wellness" element={<RequireOnboardedRoute><WellnessTemplateGalleryScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenges/wellness/:id" element={<RequireOnboardedRoute><WellnessTemplateDetailScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenges/browse" element={<RequireOnboardedRoute><BrowseChallengesScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenges/suggested" element={<RequireOnboardedRoute><SuggestedChallengesScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenges/preview" element={<RequireOnboardedRoute><ChallengePreviewScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenges/competitive" element={<RequireOnboardedRoute><RequireGroupRoute><CompetitiveChallengeScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/challenges/collective" element={<RequireOnboardedRoute><RequireGroupRoute><CollectiveChallengeScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/challenges/streak" element={<RequireOnboardedRoute><RequireGroupRoute><StreakChallengeScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/challenges/leaderboard" element={<RequireOnboardedRoute><RequireGroupRoute><ChallengeLeaderboardScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/challenges/completed" element={<RequireOnboardedRoute><RequireGroupRoute><ChallengeCompletedScreen /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/challenges/history" element={<RequireOnboardedRoute><CompletedChallengesScreen /></RequireOnboardedRoute>} />
                <Route path="/app/challenge/:id" element={<RequireOnboardedRoute><ChallengeDetailScreen /></RequireOnboardedRoute>} />
                <Route path="/app/create-challenge" element={<RequireOnboardedRoute><RequireGroupRoute><CreateChallengeWizard /></RequireGroupRoute></RequireOnboardedRoute>} />
                <Route path="/app/profile" element={<RequireOnboardedRoute><ProfileScreen /></RequireOnboardedRoute>} />
                <Route path="/app/profile/edit" element={<RequireOnboardedRoute><EditProfileScreen /></RequireOnboardedRoute>} />
                <Route path="/app/profile/settings" element={<RequireOnboardedRoute><ProfileSettingsScreen /></RequireOnboardedRoute>} />
                <Route path="/app/profile/settings/analytics" element={<RequireOnboardedRoute><ProfileAnalyticsScreen /></RequireOnboardedRoute>} />
                <Route path="/app/profile/personal-info" element={<RequireOnboardedRoute><ProfilePersonalInfoScreen /></RequireOnboardedRoute>} />
                <Route path="/app/profile/privacy-settings" element={<RequireOnboardingRoute><ProfilePrivacySettingsScreen /></RequireOnboardingRoute>} />
                <Route path="/app/profile/completion" element={<RequireOnboardingRoute><ProfileCompletionScreen /></RequireOnboardingRoute>} />
                <Route path="/app/profile/interests" element={<RequireOnboardingRoute><ProfileInterestsScreen /></RequireOnboardingRoute>} />
                <Route path="/app/profile/wellness-interests" element={<RequireOnboardingRoute><ProfileWellnessInterestsScreen /></RequireOnboardingRoute>} />
                <Route path="/app/profile/health-goals" element={<RequireOnboardingRoute><ProfileHealthGoalsScreen /></RequireOnboardingRoute>} />
                <Route path="/app/profile/setup-finish" element={<RequireOnboardingRoute><ProfileSetupFinishScreen /></RequireOnboardingRoute>} />
                <Route path="/app/onboarding/intro" element={<RequireOnboardingRoute><OnboardingSlides /></RequireOnboardingRoute>} />
                <Route path="/app/profile/learn-tiizi" element={<RequireOnboardedRoute><LearnTiiziScreen /></RequireOnboardedRoute>} />
                <Route path="/app" element={<Navigate to="/app/welcome" replace />} />

                <Route path="/" element={<Navigate to="/app/welcome" replace />} />
                <Route path="*" element={<NotFoundScreen />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
