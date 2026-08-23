import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import EnhancedModuleView from "../components/EnhancedModuleView";

const modules = ["Customers", "Products", "GPS Trackers", "Screening", "Payments", "Finance Accounts", "Users", "Alerts", "Reports", "Settings", "Audit Logs"];
describe("sidebar modules", () => {
  afterEach(cleanup);
  it.each(modules)("renders %s without a crash", (title) => {
    render(<EnhancedModuleView title={title} setShowAdd={() => {}} />);
    expect(screen.getByRole("heading", { name: new RegExp(title, "i") })).toBeInTheDocument();
  });
});
