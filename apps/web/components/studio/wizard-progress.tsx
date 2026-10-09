"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  key: string;
  label: string;
  short?: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  current: number; // 0-indexed
  onStepClick?: (index: number) => void;
}

export function WizardProgress({
  steps,
  current,
  onStepClick,
}: WizardProgressProps) {
  const total = steps.length;

  return (
    <div className="w-full">
      {/* ───── Header sutil con paso actual ───── */}
      <div className="mb-3 flex items-end justify-between text-xs">
        <span className="text-muted-foreground">
          Paso{" "}
          <strong className="text-foreground tabular-nums">{current + 1}</strong>{" "}
          de {total}
        </span>
        <span className="font-medium text-primary">{steps[current]?.label}</span>
      </div>

      {/* ───── Track de pasos ───── */}
      <ol className="relative flex w-full items-center justify-between gap-2">
        {/* Línea base */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-3 h-px bg-border/60"
        />
        {/* Línea de progreso */}
        <div
          aria-hidden
          className="absolute left-0 top-3 h-px bg-primary transition-all duration-500"
          style={{
            width: total > 1 ? `${(current / (total - 1)) * 100}%` : "0%",
          }}
        />

        {steps.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          const clickable = onStepClick && i <= current;

          return (
            <li
              key={step.key}
              className="relative z-10 flex flex-col items-center gap-2"
              style={{ flex: i === 0 || i === total - 1 ? "0 0 auto" : "1" }}
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(i)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Paso ${i + 1}: ${step.label}`}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors",
                  isDone &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  isActive &&
                    "border-primary bg-background text-primary ring-4 ring-primary/15",
                  !isDone &&
                    !isActive &&
                    "border-border bg-background text-muted-foreground",
                  clickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </button>
              <span
                className={cn(
                  "hidden text-center text-[10px] font-medium leading-tight sm:block",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.short ?? step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
