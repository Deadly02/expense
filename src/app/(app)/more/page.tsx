import { ChevronRight, Lock, Settings, Tags, Wallet, Zap } from "lucide-react";
import Link from "next/link";
import { lockDevice } from "@/app/actions/auth";
import { Card, PageTitle } from "@/components/page-bits";
import { ThemeSwitch } from "@/components/theme-switch";

const LINKS = [
  { href: "/more/categories", label: "Categories", hint: "Add, rename, hide; icons and colours", icon: Tags },
  { href: "/more/quick-adds", label: "Quick-adds", hint: "One-tap presets like Tea ₹20", icon: Zap },
  { href: "/more/wallets", label: "Wallets", hint: "Cash, bank accounts, cards", icon: Wallet },
  { href: "/more/settings", label: "Settings", hint: "Budget, defaults, change PIN", icon: Settings },
];

export default function MorePage() {
  return (
    <>
      <PageTitle>More</PageTitle>
      <div className="space-y-4">
        <nav className="divide-y overflow-hidden rounded-xl border bg-card">
          {LINKS.map(({ href, label, hint, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60">
              <Icon className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </nav>

        <Card>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Appearance</p>
          <ThemeSwitch />
        </Card>

        <form action={lockDevice}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left font-medium text-destructive hover:bg-accent/60">
            <Lock className="size-5" />
            <span className="flex-1">
              Lock this device
              <span className="block text-sm font-normal text-muted-foreground">You&apos;ll need your PIN to open the app here again.</span>
            </span>
          </button>
        </form>
      </div>
    </>
  );
}
