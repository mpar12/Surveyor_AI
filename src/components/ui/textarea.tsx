import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  [
    "flex w-full min-h-[120px]",
    "rounded-lg",
    "bg-surface",
    "text-foreground text-sm",
    "transition-all duration-200 ease-out",
    "placeholder:text-foreground-muted",
    "resize-y",
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
      textareaSize: {
        sm: "px-3 py-2 text-xs min-h-[80px]",
        default: "px-4 py-3",
        lg: "px-4 py-4 text-base min-h-[160px]"
      }
    },
    defaultVariants: {
      variant: "default",
      textareaSize: "default"
    }
  }
);

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof textareaVariants> {
  error?: boolean;
  helperText?: string;
  label?: string;
  characterCount?: boolean;
  maxLength?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant,
      textareaSize,
      error,
      helperText,
      label,
      characterCount,
      maxLength,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full">
        {(label || (characterCount && maxLength)) && (
          <div className="flex items-center justify-between mb-1.5">
            {label && (
              <label
                htmlFor={textareaId}
                className="block text-sm font-medium text-foreground"
              >
                {label}
              </label>
            )}
            {characterCount && maxLength && (
              <span
                className={cn(
                  "text-xs",
                  currentLength > maxLength
                    ? "text-error"
                    : "text-foreground-muted"
                )}
              >
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}
        <textarea
          id={textareaId}
          value={value}
          maxLength={maxLength}
          className={cn(
            textareaVariants({ variant, textareaSize }),
            error && "border-error focus:border-error focus:ring-error/20",
            className
          )}
          ref={ref}
          {...props}
        />
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
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
