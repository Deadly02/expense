"use client";

import { Repeat, Trash2 } from "lucide-react";
import { useMemo, useState, type RefObject } from "react";
import { createEntry, updateEntry } from "@/app/actions/entries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, formatDMY } from "@/lib/dates";
import { cleanAmountInput, formatRupees, paiseToInput, parseRupees } from "@/lib/money";
import { matchSuggestions } from "@/lib/suggestions";
import { PAYMENT_MODES, type Bootstrap, type Entry, type EntryInput, type EntryType, type NoteSuggestion, type PaymentMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseTagText } from "@/lib/validation";
import { useApp } from "./app-provider";
import { CategoryIcon } from "./category-icon";
import { QuickAddBar } from "./quick-add-bar";

type State = { mode: "add"; prefill?: Partial<EntryInput> } | { mode: "edit"; entry: Entry };

function initialValues(state: State, data: Bootstrap) {
  const visibleWallets = data.wallets.filter((w) => !w.hidden);
  const s = data.settings;
  const fallbackWallet =
    [s.defaultWalletId, s.lastWalletId].find((id) => id && visibleWallets.some((w) => w.id === id)) ?? visibleWallets[0]?.id ?? "";
  const src: Partial<EntryInput> = state.mode === "edit" ? state.entry : (state.prefill ?? {});
  return {
    type: (src.type ?? "expense") as EntryType,
    amountText: src.amountPaise ? paiseToInput(src.amountPaise) : "",
    note: src.note ?? "",
    categoryId: src.categoryId ?? null,
    date: src.date ?? data.today,
    paymentMode: (src.paymentMode ?? s.defaultPaymentMode ?? s.lastPaymentMode) as PaymentMode,
    walletId: src.walletId ?? fallbackWallet,
    tagText: (src.tags ?? []).map((t) => "#" + t).join(" "),
  };
}

export function EntryForm({
  state,
  data,
  amountRef,
  onDone,
}: {
  state: State;
  data: Bootstrap;
  amountRef: RefObject<HTMLInputElement | null>;
  onDone: () => void;
}) {
  const { afterAdded, removeEntry, repeat, reload } = useApp();
  const init = useMemo(() => initialValues(state, data), [state, data]);
  const [type, setType] = useState<EntryType>(init.type);
  const [amountText, setAmountText] = useState(init.amountText);
  const [note, setNote] = useState(init.note);
  const [categoryId, setCategoryId] = useState<string | null>(init.categoryId);
  const [date, setDate] = useState(init.date);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(init.paymentMode);
  const [walletId, setWalletId] = useState(init.walletId);
  const [tagText, setTagText] = useState(init.tagText);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "save" | "delete" | "repeat">(null);
  const [noteFocused, setNoteFocused] = useState(false);
  const [suggestionsOff, setSuggestionsOff] = useState(false);

  const editing = state.mode === "edit" ? state.entry : null;
  const categories = data.categories.filter((c) => c.type === type && (!c.hidden || c.id === categoryId));
  const wallets = data.wallets.filter((w) => !w.hidden || w.id === walletId);
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const suggestions = noteFocused && !suggestionsOff ? matchSuggestions(data.suggestions, note, type) : [];

  const clearError = (key: string) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: "", form: "" } : e));

  function switchType(t: EntryType) {
    if (t === type) return;
    setType(t);
    if (categoryId && catById.get(categoryId)?.type !== t) setCategoryId(null);
    clearError("categoryId");
  }

  function applySuggestion(s: NoteSuggestion) {
    setNote(s.note);
    if (catById.has(s.categoryId)) setCategoryId(s.categoryId);
    if (!amountText) setAmountText(paiseToInput(s.amountPaise));
    setPaymentMode(s.paymentMode);
    if (data.wallets.some((w) => w.id === s.walletId && !w.hidden)) setWalletId(s.walletId);
    setSuggestionsOff(true);
    setErrors({});
  }

  function toggleTag(tag: string) {
    const { tags } = parseTagText(tagText);
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTagText(next.map((t) => "#" + t).join(" "));
  }

  /** Same checks as the server, so mistakes show instantly. */
  function readForm(): { input?: EntryInput; errors: Record<string, string> } {
    const e: Record<string, string> = {};
    const paise = parseRupees(amountText);
    if (!amountText.trim()) e.amountPaise = "Enter an amount.";
    else if (paise === null) e.amountPaise = "Enter a valid amount.";
    else if (paise <= 0) e.amountPaise = "Amount must be more than ₹0.";
    if (!note.trim()) e.note = "What was this for? Add a short note.";
    else if (note.trim().length > 80) e.note = "Keep the note under 80 characters.";
    if (!categoryId) e.categoryId = "Pick a category.";
    if (!date) e.date = "Pick a date.";
    else if (date > data.today) e.date = "Date can't be in the future.";
    if (!walletId) e.walletId = "Pick a wallet.";
    const { tags, invalid } = parseTagText(tagText);
    if (invalid.length) e.tags = `Tags can use letters, numbers and dashes (e.g. #trip-goa). Check: ${invalid.join(" ")}`;
    else if (tags.length > 10) e.tags = "Use at most 10 tags.";
    if (Object.keys(e).length) return { errors: e };
    return {
      errors: {},
      input: { type, amountPaise: paise!, categoryId: categoryId!, note: note.trim(), date, paymentMode, walletId, tags },
    };
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const { input, errors: e } = readForm();
    if (!input) {
      setErrors(e);
      if (e.amountPaise) amountRef.current?.focus();
      return;
    }
    setBusy("save");
    setErrors({});
    const res = editing ? await updateEntry(editing.id, input) : await createEntry(input);
    setBusy(null);
    if (!res.ok) {
      setErrors({ ...(res.fieldErrors ?? {}), form: res.error });
      return;
    }
    if (editing) void reload();
    else afterAdded(res.data);
    onDone();
  }

  async function onDelete() {
    if (!editing || busy) return;
    setBusy("delete");
    const done = await removeEntry(editing);
    setBusy(null);
    if (done) onDone();
  }

  async function onRepeat() {
    if (!editing || busy) return;
    setBusy("repeat");
    const done = await repeat(editing);
    setBusy(null);
    if (done) onDone();
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-sm text-destructive" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-5" data-type={type}>
      {/* Money Out / Money In */}
      <div role="group" aria-label="Entry type" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => switchType(t)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition",
              type === t && "bg-background shadow-sm",
              type === t && (t === "expense" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"),
            )}
          >
            {t === "expense" ? "Money Out" : "Money In"}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label className={cn("flex items-baseline gap-1.5 border-b-2 pb-1 focus-within:border-foreground", errors.amountPaise && "border-destructive")}>
          <span className="text-3xl font-semibold text-muted-foreground" aria-hidden="true">
            ₹
          </span>
          <input
            ref={amountRef}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-label="Amount in rupees"
            value={amountText}
            onChange={(e) => {
              setAmountText(cleanAmountInput(e.target.value));
              clearError("amountPaise");
            }}
            className="w-full min-w-0 bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
          />
        </label>
        {fieldError("amountPaise")}
      </div>

      {state.mode === "add" && type === "expense" ? <QuickAddBar compact onAdded={onDone} /> : null}

      {/* Note (required) with suggestions from past notes */}
      <div className="relative">
        <Input
          name="note"
          value={note}
          maxLength={80}
          autoComplete="off"
          placeholder="What was this for?"
          aria-label="Note (what was this for?)"
          aria-invalid={!!errors.note}
          onFocus={() => setNoteFocused(true)}
          onBlur={() => setNoteFocused(false)}
          onChange={(e) => {
            setNote(e.target.value);
            setSuggestionsOff(false);
            clearError("note");
          }}
          className="h-11 text-base"
        />
        {suggestions.length > 0 && (
          <ul role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {suggestions.map((s) => {
              const c = catById.get(s.categoryId);
              return (
                <li key={s.note + s.categoryId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggestion(s)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                  >
                    {c ? <CategoryIcon icon={c.icon} color={c.color} size="sm" /> : null}
                    <span className="min-w-0 flex-1 truncate">{s.note}</span>
                    <span className="text-sm text-muted-foreground">
                      {c?.name} · {formatRupees(s.amountPaise)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {fieldError("note")}
      </div>

      {/* Category */}
      <div>
        <div role="group" aria-label="Category" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoryId === c.id}
              onClick={() => {
                setCategoryId(c.id);
                clearError("categoryId");
              }}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm font-medium transition",
                categoryId === c.id ? "border-foreground bg-foreground text-background" : "hover:border-muted-foreground/50",
              )}
            >
              <CategoryIcon icon={c.icon} color={c.color} size="sm" className={categoryId === c.id ? "bg-background/90" : ""} />
              <span className="min-w-0 truncate">{c.name}</span>
            </button>
          ))}
        </div>
        {fieldError("categoryId")}
      </div>

      {/* Date + payment mode */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium focus-within:ring-2 focus-within:ring-ring">
          <span aria-hidden="true">{date ? formatDMY(date) : "Pick date"}</span>
          <input
            type="date"
            name="date"
            aria-label="Date"
            value={date}
            max={data.today}
            onChange={(e) => {
              setDate(e.target.value);
              clearError("date");
            }}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                /* some browsers only allow this on a real tap */
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        {[
          { label: "Today", value: data.today },
          { label: "Yesterday", value: addDays(data.today, -1) },
        ].map((d) => (
          <button
            key={d.label}
            type="button"
            aria-pressed={date === d.value}
            onClick={() => setDate(d.value)}
            className={cn("h-10 rounded-lg border px-3 text-sm", date === d.value && "border-foreground font-semibold")}
          >
            {d.label}
          </button>
        ))}
      </div>
      {fieldError("date")}

      <div role="group" aria-label="Payment mode" className="grid grid-cols-4 gap-2">
        {PAYMENT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={paymentMode === m}
            onClick={() => setPaymentMode(m)}
            className={cn("h-10 rounded-lg border text-sm font-medium", paymentMode === m && "border-foreground bg-foreground text-background")}
          >
            {m}
          </button>
        ))}
      </div>

      {wallets.length > 1 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground" htmlFor="entry-wallet">
            Wallet
          </label>
          <select
            id="entry-wallet"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {fieldError("walletId")}
        </div>
      )}

      {/* Tags */}
      <div>
        <Input
          name="tags"
          value={tagText}
          autoComplete="off"
          placeholder="Tags (optional), e.g. #trip-goa #office"
          aria-label="Tags"
          onChange={(e) => {
            setTagText(e.target.value);
            clearError("tags");
          }}
        />
        {data.recentTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.recentTags.map((t) => {
              const on = parseTagText(tagText).tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(t)}
                  className={cn("rounded-full border px-2.5 py-0.5 text-xs", on && "border-foreground bg-foreground text-background")}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}
        {fieldError("tags")}
      </div>

      {errors.form && !Object.entries(errors).some(([k, v]) => k !== "form" && v) ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-1 flex items-center gap-2 bg-popover/95 px-1 pt-1 backdrop-blur md:static">
        {editing && (
          <>
            <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete} disabled={!!busy}>
              <Trash2 /> {busy === "delete" ? "Deleting…" : "Delete"}
            </Button>
            <Button type="button" variant="ghost" onClick={onRepeat} disabled={!!busy}>
              <Repeat /> {busy === "repeat" ? "Adding…" : "Repeat"}
            </Button>
          </>
        )}
        <Button type="submit" size="lg" className="ml-auto h-12 min-w-28 flex-1 text-base md:flex-none" disabled={!!busy}>
          {busy === "save" ? (editing ? "Saving…" : "Adding…") : editing ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
