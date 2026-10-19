import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CategoriesManager } from "@/components/manage/categories-manager";
import { ListSkeleton, PageTitle } from "@/components/page-bits";
import { getCategoriesData } from "@/server/data";

export default function CategoriesPage() {
  return (
    <>
      <Link href="/more" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> More
      </Link>
      <PageTitle>Categories</PageTitle>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const categories = await getCategoriesData();
  return <CategoriesManager categories={categories} />;
}
