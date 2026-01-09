import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-full",
    "text-xs font-medium",
    "transition-colors duration-200"
  ],
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        error: "bg-error-subtle text-error",
        info: "bg-info-subtle text-info",
        outline: "border border-border text-foreground-secondary",
        gradient: [
          "bg-[#FF6B35]",
          "text-white"
        ]
      },
      size: {
        sm: "h-5 px-2 text-[10px]",
        default: "h-6 px-2.5",
        lg: "h-7 px-3 text-sm"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full mr-1.5",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "error" && "bg-error",
            variant === "info" && "bg-info",
            (!variant || variant === "default") && "bg-primary",
            variant === "secondary" && "bg-foreground-muted"
          )}
        />
      )}
      {children}
    </span>
  )
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
