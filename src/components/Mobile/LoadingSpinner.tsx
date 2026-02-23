import React from 'react';

/**
 * LoadingSpinner - Consistent loading spinner
 * 
 * Purpose:
 * - Standardized loading indicator
 * - Multiple sizes for different contexts
 * - Full screen or inline options
 * 
 * Sizes:
 * - sm: 16px (inline, buttons)
 * - md: 32px (default, sections)
 * - lg: 48px (full screen)
 * 
 * @example Full screen loading
 * function MyScreen() {
 *   const { isLoading } = useMyData();
 *   
 *   if (isLoading) {
 *     return <LoadingSpinner fullScreen />;
 *   }
 *   
 *   return <div>Content</div>;
 * }
 * 
 * @example Inline loading
 * <div className="flex items-center gap-2">
 *   <LoadingSpinner size="sm" />
 *   <span>Loading...</span>
 * </div>
 * 
 * @example In button
 * <button disabled={isLoading}>
 *   {isLoading ? (
 *     <LoadingSpinner size="sm" />
 *   ) : (
 *     'Submit'
 *   )}
 * </button>
 * 
 * @example With label
 * <div className="flex flex-col items-center gap-3">
 *   <LoadingSpinner size="lg" />
 *   <p className="text-sm text-slate-500">Loading exercises...</p>
 * </div>
 */
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  label?: string;
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  fullScreen,
  label,
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',      // 16px
    md: 'w-8 h-8 border-4',      // 32px
    lg: 'w-12 h-12 border-4'     // 48px
  };
  
  const spinner = (
    <div 
      className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin ${className}`}
      role="status"
      aria-label={label || 'Loading'}
    />
  );
  
  // Full screen centered
  if (fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        {spinner}
        {label && (
          <p className="text-sm text-slate-500 font-medium">{label}</p>
        )}
      </div>
    );
  }
  
  // Inline with optional label
  if (label) {
    return (
      <div className="flex items-center gap-2">
        {spinner}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
    );
  }
  
  // Just the spinner
  return spinner;
}
