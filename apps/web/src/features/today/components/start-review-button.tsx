import { Button, buttonVariants } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link, type LinkProps } from "@tanstack/react-router";

const ACTION_CLASS = "h-11 w-full px-6 text-base font-semibold sm:w-auto";

/**
 * "Start review" call to action. With a route it is a real link that warms the review queue on
 * hover and keyboard focus (`onPrefetch`); without one (the review screen is not available yet)
 * it renders disabled instead of linking to a missing page.
 */
export default function StartReviewButton({
  to,
  onPrefetch,
}: {
  to?: NonNullable<LinkProps["to"]>;
  onPrefetch?: () => void;
}) {
  if (!to) {
    return (
      <Button size="lg" className={ACTION_CLASS} disabled>
        Start review
      </Button>
    );
  }
  return (
    <Link
      to={to}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(buttonVariants({ size: "lg" }), ACTION_CLASS)}
    >
      Start review
    </Link>
  );
}
