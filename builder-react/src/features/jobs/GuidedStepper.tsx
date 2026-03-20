import { cn } from '@/lib/utils';

export function GuidedStepper({
  currentStep,
  steps
}: {
  currentStep: number;
  steps: string[];
}) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const status = index < currentStep ? 'done' : index === currentStep ? 'active' : 'next';
        return (
          <div
            key={step}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              status === 'done' && 'border-emerald-400/45 bg-emerald-500/10',
              status === 'active' && 'border-sky-400/55 bg-sky-500/10',
              status === 'next' && 'border-border bg-secondary/20 text-muted-foreground'
            )}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-semibold">
              {index + 1}
            </span>
            <span>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

