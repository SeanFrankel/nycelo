import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-bold font-display uppercase tracking-wide ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-border active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-brutal hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-brutal-lg",
        destructive: "bg-destructive text-destructive-foreground shadow-brutal hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-brutal-lg",
        outline: "bg-background shadow-brutal hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-brutal-lg hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground shadow-brutal hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-brutal-lg",
        ghost: "border-transparent bg-transparent hover:bg-secondary active:translate-x-0 active:translate-y-0",
        link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline active:translate-x-0 active:translate-y-0",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
