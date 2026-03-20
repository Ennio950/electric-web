import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = ({ className, ...props }: AccordionPrimitive.AccordionItemProps) => (
  <AccordionPrimitive.Item className={cn('border-b border-border', className)} {...props} />
);

export const AccordionTrigger = ({ className, children, ...props }: AccordionPrimitive.AccordionTriggerProps) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      className={cn('flex flex-1 items-center justify-between py-3 text-left text-sm font-medium hover:text-accent-foreground', className)}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);

export const AccordionContent = ({ className, children, ...props }: AccordionPrimitive.AccordionContentProps) => (
  <AccordionPrimitive.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" {...props}>
    <div className={cn('pb-4 pt-1', className)}>{children}</div>
  </AccordionPrimitive.Content>
);

