import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";

/** Everything behind the PIN. The proxy redirects to /unlock without a valid cookie. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
