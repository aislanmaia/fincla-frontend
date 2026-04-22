/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  capturePostLoginRedirectFromLocation,
  clearPostLoginRedirect,
  consumePostLoginNavigateArgs,
  isReturnableFinclaPathname,
} from "../postLoginRedirect.js";

const KEY = "fincla_post_login_return";

afterEach(() => {
  sessionStorage.clear();
});

describe("isReturnableFinclaPathname", () => {
  it("aceita segmentos autenticados de primeiro nível", () => {
    expect(isReturnableFinclaPathname("/dashboard")).toBe(true);
    expect(isReturnableFinclaPathname("/transactions")).toBe(true);
  });

  it("aceita /transactions/:id com UUID ou id numérico", () => {
    expect(
      isReturnableFinclaPathname(
        "/transactions/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe(true);
    expect(isReturnableFinclaPathname("/transactions/42")).toBe(true);
    expect(isReturnableFinclaPathname("/transactions/not-a-uuid")).toBe(
      false,
    );
  });

  it("aceita /profile e abas válidas", () => {
    expect(isReturnableFinclaPathname("/profile")).toBe(true);
    expect(isReturnableFinclaPathname("/profile/account")).toBe(true);
  });

  it("rejeita raiz, rotas inválidas e open-redirect", () => {
    expect(isReturnableFinclaPathname("/")).toBe(false);
    expect(isReturnableFinclaPathname("/foo")).toBe(false);
    expect(isReturnableFinclaPathname("/profile/hack")).toBe(false);
    expect(isReturnableFinclaPathname("/dashboard/extra")).toBe(false);
  });
});

describe("capture + consume pós-login", () => {
  it("grava destino com path de edição de transação (sem fc_modal na query)", () => {
    capturePostLoginRedirectFromLocation({
      pathname: "/transactions/550e8400-e29b-41d4-a716-446655440000",
      searchStr: "",
    });
    expect(sessionStorage.getItem(KEY)).toBe(
      "/transactions/550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("grava e devolve href interno com query", () => {
    capturePostLoginRedirectFromLocation({
      pathname: "/transactions",
      searchStr: "?fc_modal=new-transaction",
    });
    expect(sessionStorage.getItem(KEY)).toBe(
      "/transactions?fc_modal=new-transaction",
    );
    expect(consumePostLoginNavigateArgs()).toEqual({
      href: "/transactions?fc_modal=new-transaction",
      replace: true,
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("não grava URLs não permitidas", () => {
    capturePostLoginRedirectFromLocation({
      pathname: "//evil.com",
      searchStr: "",
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("clearPostLoginRedirect remove o destino", () => {
    sessionStorage.setItem(KEY, "/goals");
    clearPostLoginRedirect();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
