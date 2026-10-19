"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { saveCategory } from "@/app/actions/manage";
import { useApp } from "@/components/app-provider";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon, ICON_KEYS } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Category, EntryType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChoiceRow, Field, FormDialog } from "./form-dialog";

type Draft = { id: string | null; type: EntryType; name: string; icon: string; color: string; hidden: boolean };

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const { reload } = useApp();
  const [tab, setTab] = useState<EntryType>("expense");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = categories.filter((c) => c.type === tab);

  function edit(c: Category | null) {
    setDraft(c ? { ...c } : { id: null, type: tab, name: "", icon: "circle", color: CATEGORY_COLORS[0], hidden: false });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Give the category a name.");
    setBusy(true);
    const r = await saveCategory(draft.id, { type: draft.type, name: draft.name, icon: draft.icon, color: draft.color, hidden: draft.hidden });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.success(draft.id ? "Category saved" : "Category added");
    void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ChoiceRow
          label="Type"
          value={tab}
          onChange={setTab}
          options={[
            { value: "expense", label: "Money Out" },
            { value: "income", label: "Money In" },
          ]}
        />
        <Button onClick={() => edit(null)}>
          <Plus /> Add
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => edit(c)} className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/60", c.hidden && "opacity-60")}>
              <CategoryIcon icon={c.icon} color={c.color} />
              <span className="flex-1 font-medium">{c.name}</span>
              {c.hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Hidden</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">Hidden categories don&apos;t show when adding, but old entries keep them.</p>

      {draft && (
        <FormDialog open={open} onOpenChange={setOpen} title={draft.id ? "Edit category" : "New category"} error={error} busy={busy} onSubmit={save}>
          <div className="flex items-center gap-3">
            <CategoryIcon icon={draft.icon} color={draft.color} size="lg" />
            <Input
              aria-label="Category name"
              placeholder="Name, e.g. Pets"
              value={draft.name}
              maxLength={30}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </div>
          <Field label="Icon">
            <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="Icon">
              {ICON_KEYS.map((k) => {
                const Icon = CATEGORY_ICONS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    aria-label={k}
                    aria-pressed={draft.icon === k}
                    onClick={() => setDraft({ ...draft, icon: k })}
                    className={cn("grid aspect-square place-items-center rounded-md border", draft.icon === k && "border-foreground bg-accent")}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Colour">
              {CATEGORY_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  aria-label={col}
                  aria-pressed={draft.color === col}
                  onClick={() => setDraft({ ...draft, color: col })}
                  className={cn("size-8 rounded-full ring-offset-2 ring-offset-background", draft.color === col && "ring-2 ring-foreground")}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </Field>
          {draft.id && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Hide this category</span>
              <Switch checked={draft.hidden} onCheckedChange={(v) => setDraft({ ...draft, hidden: v })} aria-label="Hide this category" />
            </label>
          )}
        </FormDialog>
      )}
    </div>
  );
}
