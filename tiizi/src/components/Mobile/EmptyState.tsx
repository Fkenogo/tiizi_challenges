import React from 'react';

/**
 * EmptyState - Consistent empty state component
 * 
 * Purpose:
 * - Display friendly message when no data
 * - Consistent styling across app
 * - Optional action button
 * 
 * @example No exercises found
 * <EmptyState
 *   icon={<Search size={48} />}
 *   title="No exercises found"
 *   message="Try adjusting your filters"
 * />
 * 
 * @example With action button
 * <EmptyState
 *   icon={<Users size={48} />}
 *   title="No groups yet"
 *   message="Create your first fitness group"
 *   action={
 *     <button 
 *       onClick={() => navigate('/groups/create')}
 *       className="px-6 py-3 bg-primary text-white rounded-xl font-bold"
 *     >
 *       Create Group
 *     </button>
 *   }
 * />
 * 
 * @example Minimal
 * <EmptyState
 *   icon={<Inbox size={48} />}
 *   title="Nothing here"
 * />
 */
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  message, 
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[50vh] p-6 text-center ${className}`}>
      <div className="text-slate-300 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-700 mb-2">{title}</h3>
      {message && (
        <p className="text-sm text-slate-500 mb-4 max-w-xs">{message}</p>
      )}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}
