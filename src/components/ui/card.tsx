import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  [
    "rounded-xl",
    "bg-surface",
    "transition-all duration-200 ease-out"
  ],
  {
    variants: {
      variant: {
        // Default card with subtle border
        default: [
          "border border-border",
          "shadow-sm"
        ],
        // Elevated card with stronger shadow
        elevated: [
          "border border-border-subtle",
          "shadow-lg"
        ],
        // Outlined card without shadow
        outline: [
          "border-2 border-border",
          "shadow-none"
        ],
        // Ghost card - minimal styling
        ghost: [
          "border-none",
          "shadow-none",
          "bg-transparent"
        ],
        // Glass effect card
        glass: [
          "bg-surface/70",
          "backdrop-blur-xl",
          "border border-white/20",
          "shadow-lg"
        ],
        // Interactive card with hover effects
        interactive: [
          "border border-border",
          "shadow-sm",
          "hover:shadow-lg hover:border-border-strong",
          "hover:-translate-y-0.5",
          "cursor-pointer"
        ],
        // Gradient border card (Coral orange)
        gradient: [
          "relative",
          "bg-surface",
          "shadow-lg",
          "border border-[#FF6B35]/20"
        ]
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        default: "p-6",
        lg: "p-8"
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "default"
    }
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-tight tracking-tight text-foreground",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-foreground-muted", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
