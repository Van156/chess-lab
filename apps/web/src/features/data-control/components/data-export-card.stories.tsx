import type { Meta, StoryObj } from "@storybook/react-vite";

import DataExportCard from "./data-export-card";

const meta = {
  title: "App/DataControl/DataExportCard",
  component: DataExportCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-full">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    urls: {
      dataJson: "http://localhost:3000/api/export/data.json",
      gamesPgn: "http://localhost:3000/api/export/games.pgn",
    },
  },
} satisfies Meta<typeof DataExportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
