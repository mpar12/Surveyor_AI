import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  [
    "flex w-full",
    "rounded-lg",
    "bg-surface",
    "text-foreground text-sm",
    "transition-all duration-200 ease-out",
    "placeholder:text-foreground-muted",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background-muted"
  ],
  {
    variants: {
      variant: {
        default: [
          "border border-border",
          "focus:border-primary focus:ring-2 focus:ring-primary/20",
          "hover:border-border-strong"
        ],
        filled: [
          "bg-background-muted border border-transparent",
          "focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20",
          "hover:bg-background-subtle"
        ],
        ghost: [
          "border-transparent bg-transparent",
          "focus:bg-surface focus:border-border focus:ring-2 focus:ring-primary/20",
          "hover:bg-background-subtle"
        ]
      },
      inputSize: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 py-2",
        lg: "h-12 px-4 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default"
    }
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  error?: boolean;
  helperText?: string;
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      variant,
      inputSize,
      error,
      helperText,
      label,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              inputVariants({ variant, inputSize }),
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-error focus:border-error focus:ring-error/20",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {helperText && (
          <p
            className={cn(
              "mt-1.5 text-xs",
              error ? "text-error" : "text-foreground-muted"
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
