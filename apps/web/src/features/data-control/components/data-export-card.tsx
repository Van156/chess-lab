import { buttonVariants } from "@b2c-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@b2c-template/ui/components/card";
import { cn } from "@b2c-template/ui/lib/utils";

import type { ExportUrls } from "../lib/export-urls";

const LINK_CLASS = cn(
  buttonVariants({ variant: "outline" }),
  "h-auto min-h-9 justify-start whitespace-normal text-left",
);

/**
 * "Your data" card. Presentational: plain anchors to the server's export endpoints. They are
 * cross-origin, so the browser ignores `download`; the server's `Content-Disposition: attachment`
 * makes the navigation save the file, and the session cookie travels with the top-level request.
 */
export default function DataExportCard({ urls }: { urls: ExportUrls }) {
  return (
    <Card aria-labelledby="data-export-title">
      <CardHeader>
        <CardTitle id="data-export-title">Your data</CardTitle>
        <CardDescription>
          Download a copy of what Chess Lab stores about you. Files are generated when you click.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <a href={urls.dataJson} className={LINK_CLASS}>
          Download all your data (JSON)
        </a>
        <a href={urls.gamesPgn} className={LINK_CLASS}>
          Download your games (PGN)
        </a>
      </CardContent>
    </Card>
  );
}
