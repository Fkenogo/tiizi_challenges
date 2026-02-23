import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockupAliases } from './data/mockupAliases';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { AdminRoute } from './components/Auth/AdminRoute';
import { RequireGroupRoute } from './components/Auth/RequireGroupRoute';
import { ToastProvider } from './context/ToastContext';
import { LoadingSpinner } from './components/Mobile';

const ExerciseLibraryScreen = lazy(() => import('./features/Exercises/ExerciseLibraryScreen'));
const ExerciseDetailScreen = lazy(() => import('./features/Exercises/ExerciseDetailScreen'));
const LogWorkoutScreen = lazy(() => import('./features/Workouts/LogWorkoutScreen'));
const SelectChallengeActivityScreen = lazy(() => import('./features/Workouts/SelectChallengeActivityScreen'));
const WorkoutLoggedScreen = lazy(() => import('./features/Workouts/WorkoutLoggedScreen'));
const HomeScreen = lazy(() => import('./features/Home/HomeScreen'));
const GroupsScreen = lazy(() => import('./features/Groups/GroupsScreen'));
const ChallengesScreen = lazy(() => import('./features/Challenges/ChallengesScreen'));
const ChallengeDetailScreen = lazy(() => import('./features/Challenges/ChallengeDetailScreen'));
const CreateChallengeWizard = lazy(() => import('./features/Challenges/CreateChallengeWizard'));
const SuggestedChallengesScreen = lazy(() => import('./features/Challenges/SuggestedChallengesScreen'));
const ChallengePreviewScreen = lazy(() => import('./features/Challenges/ChallengePreviewScreen'));
const CompetitiveChallengeScreen = lazy(() => import('./features/Challenges/CompetitiveChallengeScreen'));
const CollectiveChallengeScreen = lazy(() => import('./features/Challenges/CollectiveChallengeScreen'));
const StreakChallengeScreen = lazy(() => import('./features/Challenges/StreakChallengeScreen'));
const ChallengeLeaderboardScreen = lazy(() => import('./features/Challenges/ChallengeLeaderboardScreen'));
const ChallengeCompletedScreen = lazy(() => import('./features/Challenges/ChallengeCompletedScreen'));
const ProfileScreen = lazy(() => import('./features/Profile/ProfileScreen'));
const ProfilePersonalInfoScreen = lazy(() => import('./features/Profile/ProfilePersonalInfoScreen'));
const ProfilePrivacySettingsScreen = lazy(() => import('./features/Profile/ProfilePrivacySettingsScreen'));
const ProfileCompletionScreen = lazy(() => import('./features/Profile/ProfileCompletionScreen'));
const ProfileInterestsScreen = lazy(() => import('./features/Profile/ProfileInterestsScreen'));
const ProfileSetupFinishScreen = lazy(() => import('./features/Profile/ProfileSetupFinishScreen'));
const LoginScreen = lazy(() => import('./features/Auth/LoginScreen'));
const SignupScreen = lazy(() => import('./features/Auth/SignupScreen'));
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
const AdminCreateChallengeScreen = lazy(() => import('./features/Admin/Challenges/CreateChallengeScreen'));
const AdminChallengeAnalyticsScreen = lazy(() => import('./features/Admin/Challenges/ChallengeAnalyticsScreen'));
const DonationCampaignsScreen = lazy(() => import('./features/Admin/Donations/DonationCampaignsScreen'));
const DonationListScreen = lazy(() => import('./features/Admin/Donations/DonationListScreen'));
const DonationReportsScreen = lazy(() => import('./features/Admin/Donations/DonationReportsScreen'));
const InterestsGoalsScreen = lazy(() => import('./features/Admin/Content/InterestsGoalsScreen'));
const OnboardingContentScreen = lazy(() => import('./features/Admin/Content/OnboardingContentScreen'));
const AdminNotificationsScreen = lazy(() => import('./features/Admin/Content/NotificationsScreen'));
const AdminBooksScreen = lazy(() => import('./features/Admin/Content/BooksScreen'));
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
      retry: 2,
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <RouteViewportMode />
            <Suspense fallback={<LoadingSpinner fullScreen label="Loading screen..." />}>
              <Routes>
                <Route path="/mockups" element={<MockupCatalogScreen />} />
                <Route path="/mockups/:slug" element={<MockupScreen />} />

                {mockupAliases.map((alias) => (
                  <Route
                    key={alias.path}
                    path={alias.path}
                    element={<MockupScreen slugOverride={alias.slug} />}
                  />
                ))}

                <Route path="/app/login" element={<LoginScreen />} />
                <Route path="/app/signup" element={<SignupScreen />} />
                <Route path="/app/flow" element={<ProtectedRoute><FlowHubScreen /></ProtectedRoute>} />
                <Route path="/app/quick-actions" element={<ProtectedRoute><QuickActionsScreen /></ProtectedRoute>} />
                <Route path="/app/welcome" element={<WelcomeScreen />} />
                <Route path="/app/notifications" element={<ProtectedRoute><NotificationsScreen /></ProtectedRoute>} />
                <Route path="/app/help" element={<ProtectedRoute><HelpScreen /></ProtectedRoute>} />
                <Route path="/app/share" element={<ProtectedRoute><ShareScreen /></ProtectedRoute>} />
                <Route path="/app/donate" element={<ProtectedRoute><DonateScreen /></ProtectedRoute>} />
                <Route path="/app/library" element={<ProtectedRoute><BooksLibraryScreen /></ProtectedRoute>} />
                <Route path="/app/library/:id" element={<ProtectedRoute><BookReaderScreen /></ProtectedRoute>} />
                <Route path="/app/admin/dashboard" element={<AdminRoute><AdminDashboardScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/pending" element={<AdminRoute><AdminPendingChallengesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/approved" element={<AdminRoute><AdminApprovedChallengesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/templates" element={<AdminRoute><AdminChallengeTemplatesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/active" element={<AdminRoute><AdminActiveChallengesScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/create" element={<AdminRoute><AdminCreateChallengeScreen /></AdminRoute>} />
                <Route path="/app/admin/challenges/analytics" element={<AdminRoute><AdminChallengeAnalyticsScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises" element={<AdminRoute><AdminExerciseListScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/add" element={<AdminRoute><AdminAddExerciseScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/:id/edit" element={<AdminRoute><AdminEditExerciseScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/import" element={<AdminRoute><AdminBulkImportScreen /></AdminRoute>} />
                <Route path="/app/admin/exercises/stats" element={<AdminRoute><AdminExerciseStatsScreen /></AdminRoute>} />
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
                <Route path="/app/admin/content/books" element={<AdminRoute><AdminBooksScreen /></AdminRoute>} />
                <Route path="/app/admin/analytics" element={<AdminRoute><AdminAnalyticsOverviewScreen /></AdminRoute>} />
                <Route path="/app/admin/analytics/user-growth" element={<AdminRoute><AdminAnalyticsUserGrowthScreen /></AdminRoute>} />
                <Route path="/app/admin/analytics/engagement" element={<AdminRoute><AdminAnalyticsEngagementScreen /></AdminRoute>} />
                <Route path="/app/admin/analytics/revenue" element={<AdminRoute><AdminAnalyticsRevenueScreen /></AdminRoute>} />
                <Route path="/app/admin/settings" element={<AdminRoute><AppSettingsScreen /></AdminRoute>} />
                <Route path="/app/admin/settings/admin-users" element={<AdminRoute><AdminUsersSettingsScreen /></AdminRoute>} />
                <Route path="/app/admin/settings/logs" element={<AdminRoute><SystemLogsScreen /></AdminRoute>} />
                <Route path="/app/home" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
                <Route path="/app/exercises" element={<ProtectedRoute><ExerciseLibraryScreen /></ProtectedRoute>} />
                <Route path="/app/exercises/:id" element={<ProtectedRoute><ExerciseDetailScreen /></ProtectedRoute>} />
                <Route path="/app/workouts/log" element={<ProtectedRoute><RequireGroupRoute><LogWorkoutScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/workouts/select-activity" element={<ProtectedRoute><RequireGroupRoute><SelectChallengeActivityScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/workouts/success" element={<ProtectedRoute><RequireGroupRoute><WorkoutLoggedScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/groups" element={<ProtectedRoute><GroupsScreen /></ProtectedRoute>} />
                <Route path="/app/group/:id" element={<ProtectedRoute><GroupDetailScreen /></ProtectedRoute>} />
                <Route path="/app/group/:id/feed" element={<ProtectedRoute><GroupFeedScreen /></ProtectedRoute>} />
                <Route path="/app/group/:id/members" element={<ProtectedRoute><GroupMembersScreen /></ProtectedRoute>} />
                <Route path="/app/group/:id/leaderboard" element={<ProtectedRoute><GroupLeaderboardScreen /></ProtectedRoute>} />
                <Route path="/app/group/:id/challenges/highlighted" element={<ProtectedRoute><GroupChallengesHighlightedScreen /></ProtectedRoute>} />
                <Route path="/app/create-group" element={<ProtectedRoute><CreateGroupScreen /></ProtectedRoute>} />
                <Route path="/app/join-group" element={<ProtectedRoute><JoinGroupScreen /></ProtectedRoute>} />
                <Route path="/app/challenges" element={<ProtectedRoute><RequireGroupRoute><ChallengesScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenges/suggested" element={<ProtectedRoute><RequireGroupRoute><SuggestedChallengesScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenges/preview" element={<ProtectedRoute><RequireGroupRoute><ChallengePreviewScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenges/competitive" element={<ProtectedRoute><RequireGroupRoute><CompetitiveChallengeScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenges/collective" element={<ProtectedRoute><RequireGroupRoute><CollectiveChallengeScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenges/streak" element={<ProtectedRoute><RequireGroupRoute><StreakChallengeScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenges/leaderboard" element={<ProtectedRoute><RequireGroupRoute><ChallengeLeaderboardScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenges/completed" element={<ProtectedRoute><RequireGroupRoute><ChallengeCompletedScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/challenge/:id" element={<ProtectedRoute><RequireGroupRoute><ChallengeDetailScreen /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/create-challenge" element={<ProtectedRoute><RequireGroupRoute><CreateChallengeWizard /></RequireGroupRoute></ProtectedRoute>} />
                <Route path="/app/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
                <Route path="/app/profile/personal-info" element={<ProtectedRoute><ProfilePersonalInfoScreen /></ProtectedRoute>} />
                <Route path="/app/profile/privacy-settings" element={<ProtectedRoute><ProfilePrivacySettingsScreen /></ProtectedRoute>} />
                <Route path="/app/profile/completion" element={<ProtectedRoute><ProfileCompletionScreen /></ProtectedRoute>} />
                <Route path="/app/profile/interests" element={<ProtectedRoute><ProfileInterestsScreen /></ProtectedRoute>} />
                <Route path="/app/profile/setup-finish" element={<ProtectedRoute><ProfileSetupFinishScreen /></ProtectedRoute>} />
                <Route path="/app" element={<Navigate to="/app/welcome" replace />} />

                <Route path="/" element={<Navigate to="/app/welcome" replace />} />
                <Route path="*" element={<Navigate to="/app/flow" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
