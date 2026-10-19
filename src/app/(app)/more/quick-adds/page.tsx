import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { QuickAddsManager } from "@/components/manage/quick-adds-manager";
import { ListSkeleton, PageTitle } from "@/components/page-bits";
import { getQuickAddsData } from "@/server/data";

export default function QuickAddsPage() {
  return (
    <>
      <Link href="/more" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> More
      </Link>
      <PageTitle>Quick-adds</PageTitle>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const d = await getQuickAddsData();
  return <QuickAddsManager quickAdds={d.quickAdds} categories={d.categories} wallets={d.wallets} />;
}
