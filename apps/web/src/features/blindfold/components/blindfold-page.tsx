import { DRILL_CATALOG } from "../lib/drill-catalog";
import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldView from "./blindfold-view";

/** `/blindfold` (container): wires the static guide content and drill catalog into the view. */
export default function BlindfoldPage() {
  return <BlindfoldView sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} drills={DRILL_CATALOG} />;
}
