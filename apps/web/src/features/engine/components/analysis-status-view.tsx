import { Button } from "@b2c-template/ui/components/button";
import { Progress } from "@b2c-template/ui/components/progress";

import { describeStatus, type AnalysisStatus } from "../lib/analysis-status";

const TONE_CLASS = {
  neutral: "text-muted-foreground",
  warning: "text-warning",
  error: "text-destructive",
} as const;

/**
 * Game analysis status: progress while it runs, why it stopped (tab in the background, engine
 * unavailable, error) and a Resume action. Renders nothing while there is nothing to report. The
 * message is a polite live region so a change is announced.
 */
export default function AnalysisStatusView({
  status,
  onResume,
}: {
  status: AnalysisStatus;
  onResume: () => void;
}) {
  const description = describeStatus(status);
  if (!description) return null;
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className={`text-sm ${TONE_CLASS[description.tone]}`}>
        {description.message}
      </p>
      {description.progress === null ? null : (
        <Progress value={description.progress} aria-label="Analysis progress" />
      )}
      <div className="flex items-center gap-4">
        {description.canResume ? (
          <Button type="button" variant="outline" className="h-11 min-w-11 px-4" onClick={onResume}>
            Resume analysis
          </Button>
        ) : null}
        <a href="/licenses" className="text-xs text-muted-foreground underline">
          Engine licence
        </a>
      </div>
    </div>
  );
}
