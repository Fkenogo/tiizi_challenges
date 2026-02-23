import React from 'react';

/**
 * Card - Mobile-optimized card component
 * 
 * IMPORTANT: ONLY use these variants, never create custom cards
 * 
 * Variants:
 * - default: Standard padding (16px) - for most content
 * - compact: Tight padding (12px) - for dense layouts
 * - flat: No padding (0px) - for lists with ListItem children
 * 
 * Props:
 * - variant: 'default' | 'compact' | 'flat'
 * - interactive: Add scale animation on press
 * - onClick: Make card clickable
 * - className: Additional Tailwind classes
 * 
 * @example Standard card
 * <Card>
 *   <h4 className="text-lg font-bold">Challenge Title</h4>
 *   <p className="text-sm text-slate-500">Description</p>
 * </Card>
 * 
 * @example Compact card
 * <Card variant="compact">
 *   <div className="flex gap-2">...</div>
 * </Card>
 * 
 * @example Flat card with ListItems
 * <Card variant="flat">
 *   <ListItem title="Item 1" />
 *   <ListItem title="Item 2" />
 * </Card>
 * 
 * @example Interactive card
 * <Card interactive onClick={() => navigate('/detail')}>
 *   <p>Click me!</p>
 * </Card>
 */
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'compact' | 'flat';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Card({ 
  children, 
  variant = 'default', 
  interactive,
  onClick,
  className = ''
}: CardProps) {
  // Base styles - white background, rounded corners, border
  const baseClasses = 'bg-white rounded-xl border border-slate-100';
  
  // Variant-specific padding
  const variantClasses = {
    default: 'p-4',  // 16px padding
    compact: 'p-3',  // 12px padding
    flat: 'p-0'      // No padding (for lists)
  };
  
  // Interactive styles - scale on press, cursor pointer
  const interactiveClasses = (interactive || onClick)
    ? 'active:scale-[0.98] transition-transform cursor-pointer' 
    : '';
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${interactiveClasses} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {children}
    </div>
  );
}
