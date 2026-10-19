import { EmptyState, PageTitle } from "@/components/page-bits";

export default function OwedPage() {
  return (
    <>
      <PageTitle>Money owed</PageTitle>
      <EmptyState title="Money owed is coming in Phase 3">
        Lent and borrowed (udhaar), partial repayments and split bills.
      </EmptyState>
    </>
  );
}
