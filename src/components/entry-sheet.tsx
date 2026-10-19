"use client";

import { useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useApp, type SheetState } from "./app-provider";
import { EntryForm } from "./entry-form";

/** Bottom sheet on phones, centred dialog on laptops. Focuses the amount box on open. */
export function EntrySheet({ state, open, onClose }: { state: SheetState | null; open: boolean; onClose: () => void }) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const amountRef = useRef<HTMLInputElement>(null);
  const title = state?.mode === "edit" ? "Edit entry" : "Add entry";

  const focusAmount = (e: Event) => {
    e.preventDefault();
    amountRef.current?.focus();
  };

  const body = state ? <SheetBody key={state.key} state={state} onClose={onClose} amountRef={amountRef} /> : null;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-lg" onOpenAutoFocus={focusAmount}>
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">Amount, note, category, date and payment details</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} repositionInputs={false}>
      <DrawerContent className="max-h-[92dvh]" onOpenAutoFocus={focusAmount}>
        <DrawerHeader className="pb-0 text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">Amount, note, category, date and payment details</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}

function SheetBody({
  state,
  onClose,
  amountRef,
}: {
  state: SheetState;
  onClose: () => void;
  amountRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { data, loadError, reload } = useApp();
  if (!data) {
    return (
      <div className="space-y-3 p-5">
        {loadError ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load your categories. {loadError}
            </p>
            <Button variant="secondary" onClick={() => void reload()}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        )}
      </div>
    );
  }
  return <EntryForm state={state} data={data} amountRef={amountRef} onDone={onClose} />;
}
