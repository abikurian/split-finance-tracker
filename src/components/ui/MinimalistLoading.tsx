import { cva } from "class-variance-authority";
import { type HTMLMotionProps, motion } from "motion/react";
import { cn } from "../../lib/utils";

const loadingVariants = cva("flex gap-2 items-center justify-center", {
  variants: {
    messagePlacement: {
      bottom: "flex-col",
      top: "flex-col-reverse",
      right: "flex-row",
      left: "flex-row-reverse",
    },
  },
  defaultVariants: {
    messagePlacement: "bottom",
  },
});

export interface MinimalistLoadingProps {
  message?: string;
  messagePlacement?: "top" | "bottom" | "left" | "right";
}

export function MinimalistLoading({
  className,
  message,
  messagePlacement = "bottom",
  ...props
}: HTMLMotionProps<"div"> & MinimalistLoadingProps) {
  return (
    <div className={cn(loadingVariants({ messagePlacement }))}>
      <motion.div
        className={cn("w-10 h-10 bg-black", className)}
        animate={{ borderRadius: ["6%", "50%", "6%"] }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        {...props}
      />
      {message && <div className="text-black text-sm tracking-wide">{message}</div>}
    </div>
  );
}

export default MinimalistLoading;
