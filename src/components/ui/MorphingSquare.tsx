import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface MorphingSquareProps {
  message?: string;
  className?: string;
}

export const MorphingSquare: React.FC<MorphingSquareProps> = ({
  message = 'Loading...',
  className,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-4">
      <div className="relative flex items-center justify-center">
        {/* Glow Backdrop */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={cn(
            'absolute w-16 h-16 rounded-2xl bg-indigo-500/30 blur-xl',
            className
          )}
        />

        {/* Morphing Outer Square */}
        <motion.div
          animate={{
            scale: [1, 0.85, 1.1, 1],
            rotate: [0, 90, 180, 270, 360],
            borderRadius: ['20%', '50%', '20%', '50%', '20%'],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={cn(
            'w-14 h-14 bg-indigo-600 shadow-lg shadow-indigo-500/20 flex items-center justify-center',
            className
          )}
        >
          {/* Inner Counter-Rotating Square */}
          <motion.div
            animate={{
              scale: [0.6, 1, 0.6],
              rotate: [360, 180, 0],
              borderRadius: ['50%', '20%', '50%'],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="w-6 h-6 bg-white/90 shadow-xs"
          />
        </motion.div>
      </div>

      {message && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: [0.6, 1, 0.6], y: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="text-xs font-semibold tracking-wide text-slate-600"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
};

export default MorphingSquare;
