"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** A small dialog with a form, an error line and Save / Cancel. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  error,
  busy,
  onSubmit,
  children,
  extraActions,
  submitLabel = "Save",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
  children: ReactNode;
  extraActions?: ReactNode;
  submitLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          {children}
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="flex-row items-center gap-2 sm:justify-between">
            <div className="mr-auto">{extraActions}</div>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={
            "h-9 rounded-lg border px-3 text-sm font-medium " + (value === o.value ? "border-foreground bg-foreground text-background" : "")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
