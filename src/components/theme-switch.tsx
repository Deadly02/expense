"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mounted && theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium text-muted-foreground",
            mounted && theme === value && "bg-background text-foreground shadow-sm",
          )}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}
