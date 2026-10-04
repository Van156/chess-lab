import type { Meta, StoryObj } from "@storybook/react-vite";

import DeleteAccountCard from "./delete-account-card";

const meta = {
  title: "App/Account/DeleteAccountCard",
  component: DeleteAccountCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    email: "ada@example.com",
    onRequest: async () => {},
  },
} satisfies Meta<typeof DeleteAccountCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RequestFails: Story = {
  args: {
    onRequest: async () => {
      throw new Error("Could not start the deletion.");
    },
  },
};
