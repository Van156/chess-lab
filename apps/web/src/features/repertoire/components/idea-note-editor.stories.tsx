import type { Meta, StoryObj } from "@storybook/react-vite";

import { centreNote, emptyNote } from "./repertoire.fixtures";
import IdeaNoteEditor from "./idea-note-editor";

const meta = {
  title: "App/Repertoire/IdeaNoteEditor",
  component: IdeaNoteEditor,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    note: emptyNote,
    dirty: false,
    onChange: () => {},
    onSave: () => {},
    onClear: () => {},
  },
} satisfies Meta<typeof IdeaNoteEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithNote: Story = { args: { note: centreNote, dirty: true } };

export const PlanTooLong: Story = {
  args: { note: { ...emptyNote, plan: `${"a".repeat(140)}\nb` }, dirty: true },
};

export const Saving: Story = { args: { note: centreNote, dirty: true, saving: true } };
