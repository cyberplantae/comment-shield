"use client";
import { Children, useRef, useState, type ReactNode } from "react";

export function StepGuide({ children }: { children: ReactNode }) {
  const steps = Children.toArray(children);
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLParagraphElement>(null);
  function move(next: number) {
    setStep(next);
    heading.current?.focus();
  }
  return <div className="space-y-5">
    <p ref={heading} tabIndex={-1} className="text-sm text-[var(--color-muted)]" aria-live="polite">Step {step + 1} of {steps.length}</p>
    {steps.map((child, i) => <div key={i} hidden={i !== step}>{child}</div>)}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
      <button type="button" className="btn btn-quiet" disabled={step === 0} onClick={() => move(step - 1)}>Back</button>
      {step < steps.length - 1 ? <button type="button" className="btn btn-primary" onClick={() => move(step + 1)}>Next step →</button> : <a href="/connect" className="btn btn-primary">Continue to connection →</a>}
    </div>
  </div>;
}
