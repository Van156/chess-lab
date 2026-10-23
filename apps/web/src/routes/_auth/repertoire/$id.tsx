import { createFileRoute, Link } from "@tanstack/react-router";

import PageHeader from "@/shared/components/layout/page-header";

/** Placeholder until the builder page lands (P2-b T3). */
export const Route = createFileRoute("/_auth/repertoire/$id")({
  component: RepertoireBuilderRoute,
});

function RepertoireBuilderRoute() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Repertoire builder" description="The builder is coming soon." />
      <Link to="/repertoire" className="min-h-11 self-start underline">
        Back to repertoires
      </Link>
    </div>
  );
}
