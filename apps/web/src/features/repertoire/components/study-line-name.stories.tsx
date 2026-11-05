import type { Meta, StoryObj } from "@storybook/react-vite";

import StudyLineName from "./study-line-name";

const meta = {
  title: "App/Repertoire/StudyLineName",
  component: StudyLineName,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex max-w-sm items-center gap-1">
        <Story />
      </div>
    ),
  ],
  args: { name: null, firstMoveLabel: "4. c3", onRename: () => {} },
} satisfies Meta<typeof StudyLineName>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No name yet: a muted placeholder, the first move as a hint and the rename button. */
export const Unnamed: Story = {};

export const Named: Story = { args: { name: "Danish gambit" } };

/** A long name wraps instead of scrolling the tree sideways. */
export const LongName: Story = {
  args: {
    name: "Scotch gambit, the Danish and Goering ideas with an early queen trade for the endgame",
  },
};
