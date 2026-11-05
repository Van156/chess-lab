import { useState } from "react";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldDrillsPanel, { type StartRequest } from "./blindfold-drills-panel";
import BlindfoldView, { type BlindfoldTab } from "./blindfold-view";

/**
 * `/blindfold` (container): wires the static guide content and the drills panel into the view. A
 * "Practise with" chip in the guide switches to the Drills tab and starts that drill.
 */
export default function BlindfoldPage() {
  const [tab, setTab] = useState<BlindfoldTab>("drills");
  const [request, setRequest] = useState<StartRequest | null>(null);
  return (
    <BlindfoldView
      sections={GUIDE_SECTIONS}
      plan={TRAINING_PLAN}
      tab={tab}
      onTabChange={setTab}
      onPractise={(kind) => {
        setRequest({ kind, id: Date.now() });
        setTab("drills");
        window.scrollTo({ top: 0 });
      }}
      drillsPanel={
        <BlindfoldDrillsPanel
          drills={DRILL_CATALOG}
          startRequest={request}
          onStartRequestHandled={() => setRequest(null)}
        />
      }
    />
  );
}
