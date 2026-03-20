import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
      outline: 'border border-border text-foreground',
      success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35',
      warning: 'bg-amber-500/20 text-amber-300 border border-amber-400/35',
      danger: 'bg-red-500/20 text-red-300 border border-red-400/35'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

