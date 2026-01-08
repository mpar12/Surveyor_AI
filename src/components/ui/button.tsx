import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-medium",
    "rounded-lg",
    "transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]"
  ],
  {
    variants: {
      variant: {
        // Primary gradient button - main CTA (warm orange)
        default: [
          "bg-gradient-to-r from-orange-500 to-amber-500",
          "text-white",
          "shadow-md hover:shadow-lg hover:shadow-orange-500/25",
          "hover:brightness-105"
        ],
        // Solid primary without gradient
        solid: [
          "bg-primary text-primary-foreground",
          "hover:bg-primary-hover",
          "shadow-sm hover:shadow-md"
        ],
        // Secondary/muted button
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary-hover",
          "border border-border"
        ],
        // Outline button
        outline: [
          "border-2 border-border",
          "bg-transparent",
          "text-foreground",
          "hover:bg-secondary hover:border-border-strong"
        ],
        // Ghost button - minimal
        ghost: [
          "bg-transparent",
          "text-foreground-secondary",
          "hover:bg-secondary hover:text-foreground"
        ],
        // Destructive/error button
        destructive: [
          "bg-error text-white",
          "hover:bg-error/90",
          "shadow-sm hover:shadow-md"
        ],
        // Link style button
        link: [
          "text-primary underline-offset-4",
          "hover:underline"
        ],
        // Premium gradient with glow effect (warm orange)
        premium: [
          "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500",
          "bg-[length:200%_100%]",
          "text-white",
          "shadow-lg shadow-orange-500/25",
          "hover:shadow-xl hover:shadow-orange-500/30",
          "hover:bg-[position:100%_0]",
          "transition-all duration-500"
        ]
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        default: "h-10 px-4 py-2",
        lg: "h-12 px-6 text-base rounded-xl",
        xl: "h-14 px-8 text-lg rounded-xl",
        icon: "h-10 w-10 p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
