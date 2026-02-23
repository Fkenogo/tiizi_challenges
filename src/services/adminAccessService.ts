import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type AdminRole = 'super_admin' | 'content_manager' | 'moderator' | 'support' | 'admin' | 'member';

export type AdminPermissions = {
  canAccessAdmin: boolean;
  canModerateChallenges: boolean;
  canApproveChallenges: boolean;
  canRequestChallengeChanges: boolean;
  canManageExercises: boolean;
  canCreateExercises: boolean;
  canEditExercises: boolean;
  canDeleteExercises: boolean;
  canImportExercises: boolean;
  canExportExercises: boolean;
  canViewExerciseStats: boolean;
  canManageUsers: boolean;
  canSuspendUsers: boolean;
  canManageGroups: boolean;
  canModerateGroups: boolean;
  canFeatureGroups: boolean;
  canViewAnalytics: boolean;
  canViewUserGrowthAnalytics: boolean;
  canViewEngagementAnalytics: boolean;
  canViewRevenueAnalytics: boolean;
  canManageDonations: boolean;
  canManageContent: boolean;
  canManageNotifications: boolean;
  canManageSettings: boolean;
  canManageAppSettings: boolean;
  canManageAdminUsers: boolean;
  canViewSystemLogs: boolean;
};

const defaultPermissions: AdminPermissions = {
  canAccessAdmin: false,
  canModerateChallenges: false,
  canApproveChallenges: false,
  canRequestChallengeChanges: false,
  canManageExercises: false,
  canCreateExercises: false,
  canEditExercises: false,
  canDeleteExercises: false,
  canImportExercises: false,
  canExportExercises: false,
  canViewExerciseStats: false,
  canManageUsers: false,
  canSuspendUsers: false,
  canManageGroups: false,
  canModerateGroups: false,
  canFeatureGroups: false,
  canViewAnalytics: false,
  canViewUserGrowthAnalytics: false,
  canViewEngagementAnalytics: false,
  canViewRevenueAnalytics: false,
  canManageDonations: false,
  canManageContent: false,
  canManageNotifications: false,
  canManageSettings: false,
  canManageAppSettings: false,
  canManageAdminUsers: false,
  canViewSystemLogs: false,
};

function permissionsFromRole(role: AdminRole): AdminPermissions {
  if (role === 'super_admin') {
    return {
      canAccessAdmin: true,
      canModerateChallenges: true,
      canApproveChallenges: true,
      canRequestChallengeChanges: true,
      canManageExercises: true,
      canCreateExercises: true,
      canEditExercises: true,
      canDeleteExercises: true,
      canImportExercises: true,
      canExportExercises: true,
      canViewExerciseStats: true,
      canManageUsers: true,
      canSuspendUsers: true,
      canManageGroups: true,
      canModerateGroups: true,
      canFeatureGroups: true,
      canViewAnalytics: true,
      canViewUserGrowthAnalytics: true,
      canViewEngagementAnalytics: true,
      canViewRevenueAnalytics: true,
      canManageDonations: true,
      canManageContent: true,
      canManageNotifications: true,
      canManageSettings: true,
      canManageAppSettings: true,
      canManageAdminUsers: true,
      canViewSystemLogs: true,
    };
  }

  if (role === 'content_manager') {
    return {
      ...defaultPermissions,
      canAccessAdmin: true,
      canModerateChallenges: true,
      canApproveChallenges: true,
      canRequestChallengeChanges: true,
      canManageExercises: true,
      canCreateExercises: true,
      canEditExercises: true,
      canDeleteExercises: true,
      canImportExercises: true,
      canExportExercises: true,
      canViewExerciseStats: true,
      canViewAnalytics: true,
      canViewUserGrowthAnalytics: true,
      canViewEngagementAnalytics: true,
      canManageContent: true,
      canManageNotifications: true,
    };
  }

  if (role === 'moderator' || role === 'admin') {
    return {
      ...defaultPermissions,
      canAccessAdmin: true,
      canModerateChallenges: true,
      canApproveChallenges: true,
      canRequestChallengeChanges: true,
      canManageUsers: true,
      canSuspendUsers: true,
      canManageGroups: true,
      canModerateGroups: true,
      canFeatureGroups: true,
      canViewAnalytics: true,
      canViewUserGrowthAnalytics: true,
      canViewEngagementAnalytics: true,
      canManageNotifications: true,
      canViewSystemLogs: true,
    };
  }

  if (role === 'support') {
    return {
      ...defaultPermissions,
      canAccessAdmin: true,
      canManageUsers: true,
      canSuspendUsers: true,
      canViewSystemLogs: true,
    };
  }

  return defaultPermissions;
}

export type AdminAccessProfile = {
  role: AdminRole;
  permissions: AdminPermissions;
};

class AdminAccessService {
  async getAdminAccess(uid: string): Promise<AdminAccessProfile> {
    const adminRef = doc(db, 'admins', uid);
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      const data = adminSnap.data() as { role?: AdminRole };
      const role = data.role ?? 'member';
      return { role, permissions: permissionsFromRole(role) };
    }

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { role: 'member', permissions: defaultPermissions };

    const userData = userSnap.data() as { role?: string; profile?: { role?: string } };
    const legacyRole = (userData.role ?? userData.profile?.role) as AdminRole | undefined;
    const role: AdminRole = legacyRole ?? 'member';
    return { role, permissions: permissionsFromRole(role) };
  }
}

export const adminAccessService = new AdminAccessService();
