// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TransactionsListHeader } from "../TransactionsListHeader.jsx";

afterEach(cleanup);

describe("TransactionsListHeader — concordância depois do 'de N'", () => {
  it("'1 de 8 transações' (plural pelo total), não '1 de 8 transação'", () => {
    render(<TransactionsListHeader total={1} totalUnfiltered={8} pending={0} sum={null} fmt={(v) => String(v)} />);
    expect(document.body.textContent).toMatch(/1\s*de\s*8\s*transações/);
  });
  it("sem 'de N', concorda com o próprio total", () => {
    render(<TransactionsListHeader total={1} totalUnfiltered={null} pending={0} sum={null} fmt={(v) => String(v)} />);
    expect(document.body.textContent).toMatch(/1\s*transação/);
    expect(screen.queryByText(/transações/)).toBeNull();
  });
});
