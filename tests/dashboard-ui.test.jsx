// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../client/src/pages/DashboardPage";

const state = vi.hoisted(() => ({ data: {}, isCFO: false }));
vi.mock("../client/src/useStore", () => ({ useStore: () => state.data }));
vi.mock("../client/src/context/RoleContext", () => ({
  useRole: () => ({ isCFO: state.isCFO }),
}));
vi.mock("../client/src/components/RecordProfitModal", () => ({
  RecordProfitModal: (props) => (
    <div>
      Payment form: {props.allocationId}; pending {props.pendingAmount}; recur{" "}
      {String(props.canRecur)}
      <button onClick={props.onClose}>Done</button>
    </div>
  ),
}));
function allocation(id, partnerId, extra = {}) {
  return {
    id,
    partnerId,
    partner: { id: partnerId, name: partnerId === "a" ? "Arun" : "Priya" },
    receivedDate: "2026-08-01",
    returnDate: null,
    creditCardId: null,
    amountRupees: 10000,
    contributedAmount: 10000,
    totalCapitalReturned: 2000,
    capitalOutstanding: 8000,
    expectedMonthlyProfit: 800,
    profitPending: 300,
    profitPercent: 10,
    nextMonthProfit: 0,
    isFullyReturned: false,
    combinationReserved: false,
    ...extra,
  };
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-17T12:00:00"));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  state.isCFO = false;
  state.data = {
    isLoaded: true,
    allocationSummaries: [
      allocation("cash", "a", { returnDate: "2026-09-16" }),
      allocation("card", "a", {
        creditCardId: "hdfc",
        creditCard: { cardName: "HDFC" },
        profitPending: 0,
        nextMonthProfit: 800,
      }),
      allocation("other", "b", { returnDate: "2026-09-20" }),
    ],
    profitRecords: [
      {
        id: "pay1",
        allocationId: "cash",
        paidDate: "2026-09-01",
        amountRupees: 500,
      },
      {
        id: "pay2",
        allocationId: "card",
        paidDate: "2026-08-31",
        amountRupees: 800,
      },
    ],
    ledger: [
      {
        id: "l1",
        allocationId: "cash",
        eventType: "PROFIT_PAID",
        date: "2026-09-01",
        amountRupees: 500,
        notes: "Test payment",
        createdAt: "",
      },
    ],
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function open() {
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
function table() {
  return screen.getByRole("table", { name: "Capital and profit by partner" });
}
function total() {
  return within(table()).getAllByRole("row").at(-1).textContent;
}
it("combines capital and profit by partner and keeps source/search totals aligned", async () => {
  const user = open();
  expect(total()).toBe("Filtered total₹30,000₹6,000₹24,000₹2,400₹500₹600₹0₹500");
  await user.selectOptions(screen.getByLabelText("Funding source"), "card");
  expect(total()).toBe("Filtered total₹10,000₹2,000₹8,000₹800₹0₹0₹0₹0");
  expect(within(table()).queryByText("Priya")).toBeNull();
  expect(
    within(screen.getByRole("region", { name: "Capital summary" })).getByText(
      "₹8,000",
    ),
  ).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Funding source"), "all");
  await user.type(screen.getByLabelText("Search partner or card"), "Priya");
  expect(total()).toBe("Filtered total₹10,000₹2,000₹8,000₹800₹0₹300₹0₹0");
});
it("uses calendar-month payments without inventing historical pending snapshots", async () => {
  const user = open();
  await user.selectOptions(screen.getByLabelText("Profit month"), "2026-08");
  expect(total()).toBe("Filtered total₹30,000₹6,000₹24,000—₹800—₹0₹800");
  expect(
    screen.getByText(/Historical months show recorded payments/),
  ).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Profit month"), "2026-10");
  expect(total()).toBe("Filtered total₹30,000₹6,000₹24,000₹800₹0—₹0₹0");
});
it("expands contributions without counting combined principal as fresh money", async () => {
  state.data.allocationSummaries = [
    allocation("old", "a", {
      capitalOutstanding: 0,
      isFullyReturned: true,
      combinationReserved: true,
      combinedInto: "new",
      expectedMonthlyProfit: 0,
      totalCapitalReturned: 0,
    }),
    allocation("new", "a", {
      contributedAmount: 0,
      totalCapitalReturned: 0,
      capitalOutstanding: 10000,
      combination: { sources: [] },
    }),
  ];
  const user = open();
  expect(total()).toBe("Filtered total₹10,000₹0₹10,000₹800₹0₹600₹0₹0");
  await user.click(screen.getByRole("button", { name: "Expand Arun" }));
  expect(screen.getByText("Transferred to combined capital")).toBeTruthy();
  expect(screen.getByText("Combined balance · ₹10,000")).toBeTruthy();
  expect(total()).toBe("Filtered total₹10,000₹0₹10,000₹800₹0₹600₹0₹0");
});
it("shows date-based return reminders and read-only payment history", async () => {
  const user = open();
  expect(
    screen.getByRole("link", { name: /1 overdue capital return/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /1 due in the next 7 days/ }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "View Arun payments" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("Test payment")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Record profit" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Close payment panel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("opens the existing profit workflow with the selected allocation balance in CFO mode", async () => {
  state.isCFO = true;
  const user = open();
  await user.click(screen.getByRole("button", { name: "View Arun payments" }));
  await user.click(screen.getByRole("button", { name: "Record profit" }));
  expect(
    screen.getByText(/Payment form: cash; pending 300; recur true/),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByText("Test payment")).toBeTruthy();
});
it("distinguishes loading and empty filters and lets the user reset filters", async () => {
  const user = open();
  await user.type(screen.getByLabelText("Search partner or card"), "Missing");
  expect(screen.getByText("No contributions match your filters.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(table()).toBeTruthy();
  cleanup();
  state.data.isLoaded = false;
  open();
  expect(screen.getByRole("status").textContent).toContain("Loading");
  expect(screen.queryByRole("table")).toBeNull();
});
