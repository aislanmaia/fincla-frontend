// Regras puras da lista dos passos (fincla-api#517).
import { describe, expect, it, vi } from "vitest";

import { isAnswered, nextUnanswered, openOnRowClick, reuseUnchangedEntries } from "../entryQueue.jsx";

const e = (id, fields = {}) => ({ id, classification: "doubt", answer: null, confirmed: false, description: "x", ...fields });

describe("isAnswered", () => {
  it("sem resposta falta; sugestão só conta depois de confirmada; adicionar sem descrição ainda falta", () => {
    expect(isAnswered(e("a"))).toBe(false);
    expect(isAnswered(e("a", { answer: "ignore" }))).toBe(true);
    expect(isAnswered(e("a", { classification: "suggested", answer: "pair", confirmed: false }))).toBe(false);
    expect(isAnswered(e("a", { classification: "suggested", answer: "pair", confirmed: true }))).toBe(true);
    expect(isAnswered(e("a", { classification: "new", answer: "create", description: "  " }))).toBe(false);
    expect(isAnswered(e("a", { classification: "new", answer: "create", description: "Luz" }))).toBe(true);
  });
});

describe("nextUnanswered", () => {
  const list = [e("1"), e("2", { answer: "ignore" }), e("3"), e("4", { answer: "pair" })];

  it("acha o próximo sem resposta depois do atual, pulando os respondidos", () => {
    expect(nextUnanswered(list, "1")).toBe("3");
  });

  it("dá a volta na lista e nunca devolve o próprio", () => {
    expect(nextUnanswered(list, "3")).toBe("1");
    expect(nextUnanswered([e("1")], "1")).toBeNull();
  });

  it("sem atual, começa do início", () => {
    expect(nextUnanswered(list, null)).toBe("1");
  });
});

describe("reuseUnchangedEntries", () => {
  it("mantém o mesmo objeto para os lançamentos que não mudaram e troca só o que mudou", () => {
    const before = { entries: [e("1"), e("2")] };
    const after = { entries: [e("1"), e("2", { answer: "ignore" })] };

    const merged = reuseUnchangedEntries(before, after);

    expect(merged.entries[0]).toBe(before.entries[0]);
    expect(merged.entries[1]).toBe(after.entries[1]);
    expect(merged.entries[1].answer).toBe("ignore");
  });

  it("sem leitura anterior, fica com a nova", () => {
    const after = { entries: [e("1")] };
    expect(reuseUnchangedEntries(null, after)).toBe(after);
  });
});

describe("openOnRowClick", () => {
  it("abre num clique solto na linha, e não num clique em um controle de dentro dela", () => {
    const onOpen = vi.fn();
    const handler = openOnRowClick(onOpen);
    const row = { nodeName: "DIV" };
    const loose = { target: { closest: () => null }, currentTarget: row };
    const onButton = { target: { closest: () => ({ nodeName: "BUTTON" }) }, currentTarget: row };

    handler(onButton);
    expect(onOpen).not.toHaveBeenCalled();
    handler(loose);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
