import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SettingsForm } from "@/components/manage/settings-form";
import { ListSkeleton, PageTitle } from "@/components/page-bits";
import { getSettingsData } from "@/server/data";

export default function SettingsPage() {
  return (
    <>
      <Link href="/more" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> More
      </Link>
      <PageTitle>Settings</PageTitle>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const d = await getSettingsData();
  return <SettingsForm settings={d.settings} wallets={d.wallets} />;
}
