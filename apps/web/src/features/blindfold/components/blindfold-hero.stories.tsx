import type { Meta, StoryObj } from "@storybook/react-vite";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import BlindfoldHero from "./blindfold-hero";
import {
  ACTIVE_SUMMARY,
  FIXTURE_TODAY,
  NEW_SUMMARY,
  NOT_TODAY_SUMMARY,
} from "./blindfold-hero.fixtures";

const meta = {
  title: "App/Blindfold/BlindfoldHero",
  component: BlindfoldHero,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    summary: ACTIVE_SUMMARY,
    suggestion: { drill: DRILL_CATALOG[5]!, lastPlayedAt: "2026-10-30T18:00:00Z" },
    today: FIXTURE_TODAY,
    onStart: () => {},
  },
} satisfies Meta<typeof BlindfoldHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PractisedToday: Story = {};

export const NotYetToday: Story = { args: { summary: NOT_TODAY_SUMMARY } };

export const BrandNew: Story = {
  args: { summary: NEW_SUMMARY, suggestion: { drill: DRILL_CATALOG[0]!, lastPlayedAt: null } },
};

export const Loading: Story = { args: { summary: undefined, pending: true } };

export const Unavailable: Story = { args: { summary: undefined } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
