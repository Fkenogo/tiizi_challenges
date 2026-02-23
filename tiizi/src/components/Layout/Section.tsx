import React from 'react';

/**
 * Section - Content section with consistent spacing
 * 
 * Purpose:
 * - Groups related content
 * - Provides section title and action button
 * - Consistent spacing between child elements
 * 
 * Spacing Options:
 * - tight: 8px gaps (for dense content)
 * - normal: 12px gaps (default)
 * - loose: 16px gaps (for breathing room)
 * 
 * @example Basic section
 * <Section title="Recent Activity">
 *   <Card>Activity 1</Card>
 *   <Card>Activity 2</Card>
 * </Section>
 * 
 * @example Section with action
 * <Section 
 *   title="Challenges" 
 *   action={
 *     <button className="text-xs font-bold text-primary">See All</button>
 *   }
 * >
 *   <Card>Challenge 1</Card>
 *   <Card>Challenge 2</Card>
 * </Section>
 * 
 * @example Tight spacing
 * <Section title="Stats" spacing="tight">
 *   <div>Stat 1</div>
 *   <div>Stat 2</div>
 * </Section>
 */
interface SectionProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  spacing?: 'tight' | 'normal' | 'loose';
  className?: string;
}

export function Section({ 
  title, 
  action, 
  children, 
  spacing = 'normal',
  className = ''
}: SectionProps) {
  const spacingClasses = {
    tight: 'space-y-2',    // 8px
    normal: 'space-y-3',   // 12px (default)
    loose: 'space-y-4'     // 16px
  };
  
  return (
    <section className={`${spacingClasses[spacing]} ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
