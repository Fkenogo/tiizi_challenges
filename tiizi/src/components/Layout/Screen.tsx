import React from 'react';

/**
 * Screen - Standard screen container
 * 
 * Purpose:
 * - Provides consistent padding for all screens
 * - Handles bottom spacing for nav bar
 * - Option to remove padding for full-width content
 * 
 * Usage:
 * Wrap every screen component in this
 * 
 * @example Standard screen
 * function HomeScreen() {
 *   return (
 *     <Screen>
 *       <Section title="My Content">
 *         <Card>...</Card>
 *       </Section>
 *     </Screen>
 *   );
 * }
 * 
 * @example Full-width hero image
 * function ExerciseDetail() {
 *   return (
 *     <Screen noPadding>
 *       <div className="w-full">
 *         <img src="hero.jpg" alt="Hero" className="w-full" />
 *       </div>
 *       <div className="px-4 py-4">Content with padding</div>
 *     </Screen>
 *   );
 * }
 * 
 * @example Custom background
 * <Screen className="bg-gradient-to-b from-primary to-primary-dark">Content</Screen>
 */
interface ScreenProps {
  children: React.ReactNode;
  noPadding?: boolean;
  noBottomPadding?: boolean;
  className?: string;
}

export function Screen({ 
  children, 
  noPadding = false,
  noBottomPadding = false,
  className = '' 
}: ScreenProps) {
  return (
    <div className={`min-h-screen ${noBottomPadding ? '' : 'pb-24'} ${className}`}>
      <div className={noPadding ? '' : 'px-4 py-4'}>
        {children}
      </div>
    </div>
  );
}
