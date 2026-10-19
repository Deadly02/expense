import "server-only";
import { getEnv } from "../env";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export function getStore(): Store {
  return getEnv().backend === "memory" ? memoryStore : supabaseStore;
}

export { StoreError } from "./types";
