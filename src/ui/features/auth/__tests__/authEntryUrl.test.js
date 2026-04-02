import { describe, expect, it } from "vitest";
import { parseAuthEntryFromSearchAndHash } from "../authEntryUrl.js";

describe("parseAuthEntryFromSearchAndHash", () => {
  it("prioriza convite com invite_token", () => {
    expect(
      parseAuthEntryFromSearchAndHash("?invite_token=abc&reset_token=xyz", ""),
    ).toEqual({ kind: "invite", token: "abc" });
  });

  it("aceita invitation_token", () => {
    expect(parseAuthEntryFromSearchAndHash("?invitation_token=t1", "")).toEqual({
      kind: "invite",
      token: "t1",
    });
  });

  it("aceita action=accept_invite e token", () => {
    expect(
      parseAuthEntryFromSearchAndHash("?action=accept_invite&token=inv", ""),
    ).toEqual({ kind: "invite", token: "inv" });
  });

  it("interpreta reset_token", () => {
    expect(parseAuthEntryFromSearchAndHash("?reset_token=r1", "")).toEqual({
      kind: "reset",
      token: "r1",
    });
  });

  it("interpreta action=reset_password e token", () => {
    expect(
      parseAuthEntryFromSearchAndHash("?action=reset_password&token=r2", ""),
    ).toEqual({ kind: "reset", token: "r2" });
  });

  it("não trata token solto como reset (evita conflito com convites)", () => {
    expect(parseAuthEntryFromSearchAndHash("?token=alone", "")).toEqual({
      kind: null,
      token: null,
    });
  });

  it("lê parâmetros da hash quando ausentes na query", () => {
    expect(
      parseAuthEntryFromSearchAndHash("", "#/login?reset_token=fromhash"),
    ).toEqual({ kind: "reset", token: "fromhash" });
  });

  it("query string tem precedência sobre hash para a mesma chave", () => {
    expect(
      parseAuthEntryFromSearchAndHash(
        "?reset_token=fromsearch",
        "#?reset_token=fromhash",
      ),
    ).toEqual({ kind: "reset", token: "fromsearch" });
  });
});
