import { z } from "zod";
import { isValidIsoDate } from "./dates";
import { MAX_PAISE } from "./money";
import { ENTRY_TYPES, PAYMENT_MODES, WALLET_KINDS } from "./types";

/** Server-side checks for everything a person can send. Shared with the forms for the same messages. */

export const idSchema = z.uuid({ error: "Something went wrong (invalid id). Please refresh." });

export const amountPaiseSchema = z
  .number({ error: "Enter an amount." })
  .int({ error: "Enter a valid amount." })
  .min(1, { error: "Amount must be more than ₹0." })
  .max(MAX_PAISE, { error: "That amount is too large." });

export const noteSchema = z
  .string({ error: "What was this for?" })
  .trim()
  .min(1, { error: "What was this for? Add a short note." })
  .max(80, { error: "Keep the note under 80 characters." });

export const isoDateSchema = z
  .string({ error: "Pick a date." })
  .refine(isValidIsoDate, { error: "Pick a valid date." });

export const tagSchema = z
  .string()
  .trim()
  .transform((t) => t.replace(/^#+/, "").toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9][a-z0-9-]{0,29}$/, { error: "Tags can use letters, numbers and dashes (e.g. #trip-goa)." }));

export const tagsSchema = z.array(tagSchema).max(10, { error: "Use at most 10 tags." }).transform((t) => [...new Set(t)]);

export const entryInputSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  amountPaise: amountPaiseSchema,
  categoryId: idSchema,
  note: noteSchema,
  date: isoDateSchema,
  paymentMode: z.enum(PAYMENT_MODES),
  walletId: idSchema,
  tags: tagsSchema.default([]),
});

export const categoryInputSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  name: z.string().trim().min(1, { error: "Give the category a name." }).max(30, { error: "Keep the name under 30 characters." }),
  icon: z.string().regex(/^[a-z0-9-]{1,40}$/, { error: "Pick an icon." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Pick a colour." }),
  hidden: z.boolean().default(false),
});

export const walletInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Give the wallet a name." }).max(30, { error: "Keep the name under 30 characters." }),
  kind: z.enum(WALLET_KINDS),
  hidden: z.boolean().default(false),
});

export const quickAddInputSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  amountPaise: amountPaiseSchema,
  categoryId: idSchema,
  note: noteSchema,
  paymentMode: z.enum(PAYMENT_MODES),
  walletId: idSchema,
});

export const settingsInputSchema = z.object({
  monthlyBudgetPaise: z.number().int().min(0).max(MAX_PAISE).nullable(),
  defaultPaymentMode: z.enum(PAYMENT_MODES).nullable(),
  defaultWalletId: idSchema.nullable(),
});

export const pinSchema = z
  .string({ error: "Enter your PIN." })
  .min(1, { error: "Enter your PIN." })
  .max(64, { error: "That PIN is too long." });

/** Turns "#trip-goa, office  #Trip-Goa" into ["trip-goa", "office"]; invalid bits are reported. */
export function parseTagText(text: string): { tags: string[]; invalid: string[] } {
  const tags: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    if (!raw.replace(/#/g, "")) continue;
    const r = tagSchema.safeParse(raw);
    if (r.success) {
      if (!tags.includes(r.data)) tags.push(r.data);
    } else invalid.push(raw);
  }
  return { tags, invalid };
}

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
