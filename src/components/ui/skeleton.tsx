import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "rectangular";
  animation?: "pulse" | "shimmer" | "none";
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "default", animation = "shimmer", ...props }, ref) => {
    const baseClasses = "bg-background-muted";

    const variantClasses = {
      default: "rounded-md",
      circular: "rounded-full",
      rectangular: "rounded-none"
    };

    const animationClasses = {
      pulse: "animate-pulse-soft",
      shimmer: "animate-shimmer",
      none: ""
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          animationClasses[animation],
          className
        )}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

// Pre-built skeleton patterns
const SkeletonText = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { lines?: number }
>(({ className, lines = 3, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn(
          "h-4",
          i === lines - 1 ? "w-3/4" : "w-full"
        )}
      />
    ))}
  </div>
));
SkeletonText.displayName = "SkeletonText";

const SkeletonCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-border bg-surface p-6 space-y-4",
      className
    )}
    {...props}
  >
    <div className="flex items-center space-x-4">
      <Skeleton variant="circular" className="h-12 w-12" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
    <SkeletonText lines={3} />
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

const SkeletonAvatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "default" | "lg" }
>(({ className, size = "default", ...props }, ref) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    default: "h-10 w-10",
    lg: "h-14 w-14"
  };

  return (
    <Skeleton
      ref={ref}
      variant="circular"
      className={cn(sizeClasses[size], className)}
      {...props}
    />
  );
});
SkeletonAvatar.displayName = "SkeletonAvatar";

export { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar };
