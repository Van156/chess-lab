import {
  ENGINE_ID,
  ENGINE_LICENSE_PATH,
  ENGINE_LICENSE_URL,
  ENGINE_PACKAGE_VERSION,
  ENGINE_SOURCE_URL,
  ENGINE_WASM_PATH,
  ENGINE_WORKER_PATH,
} from "../config";

const OPENINGS_REPO_URL = "https://github.com/lichess-org/chess-openings";
const OPENINGS_LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

const linkClass = "underline underline-offset-4";

const SERVED_FILES = [
  { href: ENGINE_WORKER_PATH, label: `${ENGINE_ID}.js`, note: "engine worker script" },
  { href: ENGINE_WASM_PATH, label: `${ENGINE_ID}.wasm`, note: "engine WebAssembly binary" },
  { href: ENGINE_LICENSE_PATH, label: "Copying.txt", note: "full GPL-3.0 licence text" },
] as const;

/**
 * Public licence page (NFR-08). Stockfish is GPL-3.0 and ships as a separate, unmodified static
 * file loaded in a Web Worker; this page offers its licence text and its source. Presentational:
 * everything comes from the engine config, so it renders without data or a session.
 */
export default function LicensesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <a href="/" className={`${linkClass} text-sm`}>
          Back to the app
        </a>
        <h1 className="text-2xl font-semibold">Licences</h1>
      </header>

      <section aria-labelledby="engine-heading" className="flex flex-col gap-3">
        <h2 id="engine-heading" className="text-lg font-medium">
          Stockfish chess engine
        </h2>
        <p>
          Game analysis runs in your browser with Stockfish {ENGINE_PACKAGE_VERSION} (the lite,
          single-thread WebAssembly build). Stockfish is free software licensed under the{" "}
          <a href={ENGINE_LICENSE_URL} className={linkClass} rel="noreferrer">
            GNU General Public License, version 3
          </a>{" "}
          (GPL-3.0).
        </p>
        <p>
          The engine is served as its own, unmodified static files and runs in a separate Web
          Worker. It is not part of the application code or its JavaScript bundle, and the
          application does not modify it.
        </p>
      </section>

      <section aria-labelledby="source-heading" className="flex flex-col gap-3">
        <h2 id="source-heading" className="text-lg font-medium">
          Source code
        </h2>
        <p>
          The corresponding source for the engine build we serve (stockfish.js, npm package{" "}
          <code>stockfish@{ENGINE_PACKAGE_VERSION}</code>) is available at{" "}
          <a href={ENGINE_SOURCE_URL} className={linkClass} rel="noreferrer">
            {ENGINE_SOURCE_URL}
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="files-heading" className="flex flex-col gap-3">
        <h2 id="files-heading" className="text-lg font-medium">
          Files served as-is
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {SERVED_FILES.map((file) => (
            <li key={file.href}>
              <a href={file.href} className={linkClass}>
                {file.label}
              </a>{" "}
              <span className="text-muted-foreground">({file.note})</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="openings-heading" className="flex flex-col gap-3">
        <h2 id="openings-heading" className="text-lg font-medium">
          Opening names
        </h2>
        <p>
          The opening names in the repertoire builder come from the{" "}
          <a href={OPENINGS_REPO_URL} className={linkClass} rel="noreferrer">
            lichess-org/chess-openings
          </a>{" "}
          dataset, released under the{" "}
          <a href={OPENINGS_LICENSE_URL} className={linkClass} rel="noreferrer">
            CC0 1.0 Universal
          </a>{" "}
          public domain dedication (CC0-1.0). We bundle a copy of it, converted to an index by
          position.
        </p>
      </section>
    </main>
  );
}
