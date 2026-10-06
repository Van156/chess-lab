import type { Meta, StoryObj } from "@storybook/react-vite";

import type { LichessDeleteResult } from "../lib/lichess-account";
import LichessDeleteCard from "./lichess-delete-card";

const meta = {
  title: "App/Account/LichessDeleteCard",
  component: LichessDeleteCard,
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
    username: "magnus",
    onDelete: async (): Promise<LichessDeleteResult> => ({ ok: true }),
    onReauth: () => {},
  },
} satisfies Meta<typeof LichessDeleteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReturningFromReauth: Story = { args: { confirmRequested: true } };

export const ReauthRequired: Story = {
  args: { onDelete: async () => ({ ok: false, code: "REAUTH_REQUIRED" }) },
};

export const UsernameMismatch: Story = {
  args: { onDelete: async () => ({ ok: false, code: "USERNAME_MISMATCH" }) },
};
