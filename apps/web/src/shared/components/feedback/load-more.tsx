import { Button } from "@b2c-template/ui/components/button";

/**
 * "Load more" control of a paged list (presentational). When fetching the next page failed, the
 * pages already on screen stay and an alert says so beside a retry; the message is dropped as
 * soon as the retry is in flight.
 */
export default function LoadMore({
  noun,
  loading,
  failed,
  onLoadMore,
}: {
  /** Plural name of the items, for the labels ("games", "mistakes"). */
  noun: string;
  loading: boolean;
  /** The last request for the next page failed. */
  failed: boolean;
  onLoadMore: () => void;
}) {
  const showError = failed && !loading;
  return (
    <div className="flex flex-col items-center gap-2">
      {showError ? (
        <p role="alert" className="text-sm text-destructive">
          More {noun} could not be loaded.
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-11 px-6"
        disabled={loading}
        onClick={onLoadMore}
      >
        {loading ? `Loading ${noun}` : showError ? "Try again" : `Load more ${noun}`}
      </Button>
    </div>
  );
}
