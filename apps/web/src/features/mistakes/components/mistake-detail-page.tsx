import { buttonVariants } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Crosshair } from "lucide-react";
import { useMemo } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { useMistake } from "../hooks/use-mistakes";
import { isNotFound, movesFromPgn } from "../lib/mistake-format";
import MistakeDetailView from "./mistake-detail-view";

/** `/mistakes/$id` (container): loads one mistake and parses its game's PGN for the move list. */
export default function MistakeDetailPage({ id }: { id: string }) {
  const { mistake, error, isPending, retry } = useMistake(id);
  const pgn = mistake?.game.pgn;
  const moves = useMemo(() => (pgn ? movesFromPgn(pgn) : []), [pgn]);

  if (isPending) {
    return <Loader />;
  }
  if (isNotFound(error)) {
    return (
      <EmptyState
        icon={<Crosshair />}
        title="Mistake not found"
        description="It may have been removed, or it belongs to another account."
        action={
          <Link to="/mistakes" className={cn(buttonVariants(), "h-11 px-6")}>
            Back to mistakes
          </Link>
        }
      />
    );
  }
  if (!mistake) {
    return <LoadError message="This mistake could not be loaded." onRetry={retry} />;
  }
  return <MistakeDetailView mistake={mistake} moves={moves} />;
}
