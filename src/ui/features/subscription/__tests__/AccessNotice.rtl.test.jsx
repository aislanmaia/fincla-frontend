// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

import { AccessNotice } from "../AccessNotice.jsx";

const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const trialUser = (role = "owner") => ({
  role,
  is_consultant: false,
  subscription: { plan: "pro", status: "pending_payment", is_entitled: true, courtesy_plan: "pro", courtesy_until: inDays(3) },
});

beforeEach(() => navigate.mockReset());
afterEach(cleanup);

it("lets a courtesy close to its end subscribe right away", () => {
  render(<AccessNotice user={trialUser()} />);
  expect(screen.getByText(/o plano começa a contar no dia do pagamento/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Assinar agora/ }));
  expect(navigate).toHaveBeenCalledWith({ to: "/checkout" });
});

it("does not offer the purchase to a member of someone else's account", () => {
  render(<AccessNotice user={trialUser("member")} />);
  expect(screen.queryByRole("button", { name: /Assinar agora/ })).toBeNull();
  expect(screen.getByRole("button", { name: /Ver plano e acesso/ })).toBeInTheDocument();
});
