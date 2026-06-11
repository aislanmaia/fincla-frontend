import { describe, expect, it } from "vitest";
import {
  maskBrDateInput,
  parseBrDateLooseOnCommit,
  parseBrDateLooseResult,
} from "../localeDateInputParse.js";

const MIN = "2000-01-01";
const MAX = "2100-12-31";

describe("maskBrDateInput", () => {
  it("formata dígitos como dd/mm/aaaa", () => {
    expect(maskBrDateInput("")).toBe("");
    expect(maskBrDateInput("0")).toBe("0");
    expect(maskBrDateInput("01")).toBe("01");
    expect(maskBrDateInput("0105")).toBe("01/05");
    expect(maskBrDateInput("01052026")).toBe("01/05/2026");
    expect(maskBrDateInput("01/05/2026")).toBe("01/05/2026");
  });

  it("limita a 8 dígitos", () => {
    expect(maskBrDateInput("010520261999")).toBe("01/05/2026");
  });
});

describe("parseBrDateLooseResult", () => {
  it("só aceita ano completo (4 dígitos) durante a digitação", () => {
    expect(parseBrDateLooseResult("01/05/20", MIN, MAX).status).toBe("incomplete");
    expect(parseBrDateLooseResult("01/05/202", MIN, MAX).status).toBe("incomplete");
    expect(parseBrDateLooseResult("01/05/26", MIN, MAX).status).toBe("incomplete");
    expect(parseBrDateLooseResult("010526", MIN, MAX).status).toBe("incomplete");
  });

  it("valida quando o ano tem 4 dígitos", () => {
    expect(parseBrDateLooseResult("01/05/2026", MIN, MAX)).toEqual({
      status: "ok",
      ymd: "2026-05-01",
    });
    expect(parseBrDateLooseResult("01052026", MIN, MAX)).toEqual({
      status: "ok",
      ymd: "2026-05-01",
    });
  });
});

describe("parseBrDateLooseOnCommit", () => {
  it("expande ano com 2 dígitos no blur/Enter", () => {
    expect(parseBrDateLooseOnCommit("01/05/26", MIN, MAX)).toEqual({
      status: "ok",
      ymd: "2026-05-01",
    });
    expect(parseBrDateLooseOnCommit("010526", MIN, MAX)).toEqual({
      status: "ok",
      ymd: "2026-05-01",
    });
  });
});
