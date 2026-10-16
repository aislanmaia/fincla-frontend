// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveBlob } from "../saveBlob.js";

describe("saveBlob", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("clica com o link no DOM e só libera a URL depois de um tempo", () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const seen = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record() { seen.push({ inDom: document.body.contains(this), download: this.download, href: this.href }); });
    saveBlob(new Blob(["a"]), "arquivo.csv");
    expect(seen).toEqual([{ inDom: true, download: "arquivo.csv", href: "blob:x" }]);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30000);
    expect(revoke).toHaveBeenCalledWith("blob:x");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
