import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { WalletsManager } from "@/components/manage/wallets-manager";
import { ListSkeleton, PageTitle } from "@/components/page-bits";
import { getWalletsData } from "@/server/data";

export default function WalletsPage() {
  return (
    <>
      <Link href="/more" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> More
      </Link>
      <PageTitle>Wallets</PageTitle>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const wallets = await getWalletsData();
  return <WalletsManager wallets={wallets} />;
}
