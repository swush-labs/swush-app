import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedGlowBorderProps {
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  variant?: 'default' | 'validation';
}

/**
 * Reusable animated glowing border component
 * Used for loading states and special effects
 * 
 * Variants:
 * - default: Orange glow for fetching/loading data
 * - validation: Blue/cyan glow for validation/simulation
 */
export const AnimatedGlowBorder = ({ 
  children, 
  className = '', 
  isActive = true,
  variant = 'default'
}: AnimatedGlowBorderProps) => {
  if (!isActive) {
    return <>{children}</>;
  }

  // Define colors based on variant
  const colors = variant === 'validation' 
    ? {
        // Cyan/blue colors for validation
        borderClass: 'border-cyan-400/60',
        boxShadow: [
          '0 0 15px rgba(34, 211, 238, 0.3)',
          '0 0 30px rgba(34, 211, 238, 0.7)',
          '0 0 15px rgba(34, 211, 238, 0.3)',
        ],
        borderColor: [
          'rgba(34, 211, 238, 0.6)',
          'rgba(103, 232, 249, 0.9)',
          'rgba(34, 211, 238, 0.6)',
        ]
      }
    : {
        // Orange colors for default (quote fetching)
        borderClass: 'border-flame-400/60',
        boxShadow: [
          '0 0 15px rgba(249, 115, 22, 0.3)',
          '0 0 30px rgba(249, 115, 22, 0.7)',
          '0 0 15px rgba(249, 115, 22, 0.3)',
        ],
        borderColor: [
          'rgba(249, 115, 22, 0.6)',
          'rgba(251, 146, 60, 0.9)',
          'rgba(249, 115, 22, 0.6)',
        ]
      };

  return (
    <div className={`relative ${className}`}>
      {/* Animated glowing border */}
      <motion.div 
        className={`absolute -inset-[2px] rounded-full border-2 ${colors.borderClass} z-0`}
        animate={{
          boxShadow: colors.boxShadow,
          borderColor: colors.borderColor
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      {children}
    </div>
  );
};
