import { Card } from "@b2c-template/ui/components/card";
import { BookMarked } from "lucide-react";

import EmptyState from "@/shared/components/feedback/empty-state";
import PageHeader from "@/shared/components/layout/page-header";

import type { RepertoireColor, RepertoireSummary } from "../lib/repertoire-types";
import CreateRepertoireForm, { type CreateRepertoireFormProps } from "./create-repertoire-form";
import RepertoireRow from "./repertoire-row";

export type RepertoireListViewProps = {
  repertoires: readonly RepertoireSummary[];
  onCreate: CreateRepertoireFormProps["onCreate"];
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
};

const SECTIONS: readonly { color: RepertoireColor; title: string }[] = [
  { color: "white", title: "Playing White" },
  { color: "black", title: "Playing Black" },
];

/** Repertoire list (presentational): create one, then rename, delete or open each, grouped by colour. */
export default function RepertoireListView({
  repertoires,
  onCreate,
  onRename,
  onDelete,
}: RepertoireListViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Repertoire"
        description="Your opening lines, one repertoire per colour and plan"
      />
      <Card className="rounded-2xl p-4 md:p-6">
        <h2 className="text-base font-medium">New repertoire</h2>
        <CreateRepertoireForm onCreate={onCreate} />
      </Card>
      {repertoires.length === 0 ? (
        <EmptyState
          icon={<BookMarked />}
          title="No repertoires yet"
          description="Create one above, then add the moves you want to play."
        />
      ) : (
        SECTIONS.map(({ color, title }) => {
          const items = repertoires.filter((repertoire) => repertoire.color === color);
          return items.length === 0 ? null : (
            <section key={color} aria-label={title} className="flex flex-col gap-3">
              <h2 className="text-base font-medium">{title}</h2>
              <ul className="flex flex-col gap-3">
                {items.map((repertoire) => (
                  <li key={repertoire.id}>
                    <RepertoireRow
                      repertoire={repertoire}
                      onRename={(name) => onRename(repertoire.id, name)}
                      onDelete={() => onDelete(repertoire.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
