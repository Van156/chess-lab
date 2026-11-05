import type { Meta, StoryObj } from "@storybook/react-vite";

import { GUIDE_SECTIONS } from "../lib/guide-content";
import GuideDiagram from "./guide-diagram";

function diagramOf(id: string) {
  const diagram = GUIDE_SECTIONS.find((section) => section.id === id)?.diagram;
  if (!diagram) throw new Error(`No diagram for ${id}`);
  return diagram;
}

const meta = {
  title: "App/Blindfold/GuideDiagram",
  component: GuideDiagram,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-60">
        <Story />
      </div>
    ),
  ],
  args: { diagram: diagramOf("knight-geometry") },
} satisfies Meta<typeof GuideDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Highlights: Story = { args: { diagram: diagramOf("square-colours") } };

export const Arrows: Story = { args: { diagram: diagramOf("diagonals") } };

export const Pieces: Story = { args: { diagram: diagramOf("piece-lists") } };

export const Check: Story = { args: { diagram: diagramOf("checks-and-lines") } };

export const Capture: Story = { args: { diagram: diagramOf("following-moves") } };

export const NoLabels: Story = { args: { showLabels: false, showCaption: false } };
