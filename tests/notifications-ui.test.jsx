// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NotificationBell } from "../client/src/components/NotificationBell";

vi.mock("../client/src/store", () => ({ computeNextDueDate: vi.fn() }));

vi.mock("../client/src/useStore", () => ({
  useStore: () => ({
    partnerSummaries: [{
      partner: { id: "partner-1", name: "Arun" },
      totalProfitPending: 2000,
      expectedMonthlyProfit: 1000,
      nextReturnDate: "2026-09-16",
      capitalOutstanding: 10000,
    }],
    creditCards: [],
    allocationSummaries: [],
  }),
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-17T12:00:00Z"));
  const storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}
function setup() {
  return render(
    <MemoryRouter>
      <header style={{ backdropFilter: "blur(16px)", height: 72 }}>
        <NotificationBell />
      </header>
      <Location />
    </MemoryRouter>,
  );
}

it("renders alert details outside the constrained top bar and opens the related page", async () => {
  const user = userEvent.setup();
  const { container } = setup();
  await user.click(screen.getByRole("button", { name: "Notifications (2 unread)" }));
  const drawer = screen.getByRole("dialog", { name: "Notifications" });
  expect(container.contains(drawer)).toBe(false);
  expect(within(drawer).getByText("₹2,000 profit pending (multiple months)")).toBeTruthy();
  expect(within(drawer).getByText("₹10,000 was due on 2026-09-16")).toBeTruthy();
  await user.click(within(drawer).getByRole("button", { name: /Profit overdue — Arun/ }));
  expect(screen.getByTestId("location").textContent).toBe("/pending-profits");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("keeps the bell count in sync when dismissing, marking all read, and restoring alerts", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByRole("button", { name: "Notifications (2 unread)" }));
  await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
  expect(screen.getByRole("button", { name: "Notifications (1 unread)" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Mark all read" }));
  expect(screen.getByRole("button", { name: "Notifications", exact: true })).toBeTruthy();
  expect(screen.getByText("All clear! No pending alerts.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Show 2 dismissed" }));
  expect(screen.getByRole("button", { name: "Notifications (2 unread)" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
