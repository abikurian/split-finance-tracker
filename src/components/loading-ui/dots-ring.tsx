import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface DotsRingProps {
  className?: string;
}

export const DotsRing: React.FC<DotsRingProps> = ({ className }) => {
  const dotsCount = 8;
  const radius = 36;

  return (
    <div className={cn('relative w-full h-full flex items-center justify-center', className)}>
      <motion.svg
        viewBox="0 0 100 100"
        className="w-full h-full text-current shrink-0"
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.6,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'linear',
        }}
      >
        {Array.from({ length: dotsCount }).map((_, i) => {
          const angle = (i * 360) / dotsCount;
          const rad = (angle * Math.PI) / 180;
          const cx = 50 + radius * Math.cos(rad);
          const cy = 50 + radius * Math.sin(rad);

          return (
            <motion.circle
              key={i}
              cx={cx}
              cy={cy}
              r="6.5"
              fill="currentColor"
              animate={{
                scale: [0.35, 1.1, 0.35],
                opacity: [0.2, 1, 0.2],
              }}
              transition={{
                duration: 1.2,
                repeat: Number.POSITIVE_INFINITY,
                delay: (i * 1.2) / dotsCount,
                ease: 'easeInOut',
              }}
            />
          );
        })}
      </motion.svg>
    </div>
  );
};

export default DotsRing;
