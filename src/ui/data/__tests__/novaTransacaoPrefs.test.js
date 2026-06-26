/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  clampNovaTxPrefsParcelas,
  normalizeStoredNovaTxPaymentMethod,
  readStoredNovaTransacaoPrefs,
  resolveStoredNovaTxCategorySelection,
  serializeNovaTxFormStateToStoredPrefs,
  shouldApplyStoredNovaTxCategoryPrefs,
  writeStoredNovaTransacaoPrefs,
} from "../transactionsAdapter.js";

describe("Nova transação — prefs persistidas", () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe("normalizeStoredNovaTxPaymentMethod", () => {
    it("rejeita crédito para receita", () => {
      expect(normalizeStoredNovaTxPaymentMethod("credito", "receita")).toBeNull();
      expect(normalizeStoredNovaTxPaymentMethod("pix", "receita")).toBe("pix");
    });

    it("aceita crédito para despesa", () => {
      expect(normalizeStoredNovaTxPaymentMethod("credito", "despesa")).toBe(
        "credito",
      );
    });
  });

  describe("clampNovaTxPrefsParcelas", () => {
    it("aceita entradas válidas", () => {
      expect(clampNovaTxPrefsParcelas(1)).toBe(1);
      expect(clampNovaTxPrefsParcelas(12)).toBe(12);
      expect(clampNovaTxPrefsParcelas(360)).toBe(360);
    });

    it("rejeita fora do intervalo", () => {
      expect(clampNovaTxPrefsParcelas(0)).toBeNull();
      expect(clampNovaTxPrefsParcelas(361)).toBeNull();
      expect(clampNovaTxPrefsParcelas(NaN)).toBeNull();
    });
  });

  describe("serializeNovaTxFormStateToStoredPrefs", () => {
    it("com método diferente de crédito não persiste modalidade nem cartão", () => {
      const o = serializeNovaTxFormStateToStoredPrefs({
        tipo: "despesa",
        method: "pix",
        cat: "Alimentação",
        categoryTagId: null,
        modalidade: "parcelado",
        parcelas: 12,
        cartao: "card-uuid",
      });
      expect(o.method).toBe("pix");
      expect(o.modalidade).toBeNull();
      expect(o.parcelas).toBeNull();
      expect(o.cartaoId).toBeNull();
      expect(o.cat).toBe("Alimentação");
    });

    it("com crédito persiste modalidade, parcelas e cartão", () => {
      const o = serializeNovaTxFormStateToStoredPrefs({
        tipo: "despesa",
        method: "credito",
        cat: null,
        categoryTagId: "550e8400-e29b-41d4-a716-446655440000",
        modalidade: "avista",
        parcelas: 1,
        cartao: "aa0e8400-e29b-41d4-a716-446655440099",
      });
      expect(o.method).toBe("credito");
      expect(o.modalidade).toBe("avista");
      expect(o.parcelas).toBe(1);
      expect(o.cartaoId).toBe("aa0e8400-e29b-41d4-a716-446655440099");
      expect(o.categoryTagId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("não persiste placeholder «novo» como cartão", () => {
      const o = serializeNovaTxFormStateToStoredPrefs({
        tipo: "despesa",
        method: "credito",
        cat: "",
        categoryTagId: null,
        modalidade: "parcelado",
        parcelas: 3,
        cartao: "novo",
      });
      expect(o.cartaoId).toBeNull();
    });

    it("normaliza receita + crédito inválido para pix", () => {
      const o = serializeNovaTxFormStateToStoredPrefs({
        tipo: "receita",
        method: "credito",
        cat: "",
        categoryTagId: null,
        modalidade: "parcelado",
        parcelas: 6,
        cartao: "x",
      });
      expect(o.method).toBe("pix");
      expect(o.cartaoId).toBeNull();
      expect(o.modalidade).toBeNull();
    });
  });

  describe("read/write localStorage", () => {
    it("write + read preserva o objeto serializado", () => {
      const payload = serializeNovaTxFormStateToStoredPrefs({
        tipo: "despesa",
        method: "credito",
        cat: "Transporte",
        categoryTagId: null,
        modalidade: "avista",
        parcelas: 1,
        cartao: "nubank",
      });
      writeStoredNovaTransacaoPrefs("org-1", payload);
      const back = readStoredNovaTransacaoPrefs("org-1");
      expect(back).toEqual(payload);
    });
  });

  describe("shouldApplyStoredNovaTxCategoryPrefs", () => {
    it("não aplica durante edição por id", () => {
      expect(
        shouldApplyStoredNovaTxCategoryPrefs({
          editingTransactionId: "99",
        }),
      ).toBe(false);
    });

    it("não aplica se categoria veio no preConfig", () => {
      expect(
        shouldApplyStoredNovaTxCategoryPrefs({ cat: "Moradia" }),
      ).toBe(false);
      expect(
        shouldApplyStoredNovaTxCategoryPrefs({
          categoryTagId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      ).toBe(false);
    });

    it("aplica para nova transação ou só cartão/método no preConfig", () => {
      expect(shouldApplyStoredNovaTxCategoryPrefs(null)).toBe(true);
      expect(
        shouldApplyStoredNovaTxCategoryPrefs({
          tipo: "despesa",
          method: "credito",
          cartaoId: "abc",
        }),
      ).toBe(true);
    });
  });

  describe("resolveStoredNovaTxCategorySelection", () => {
    const rows = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        labelPt: "Alimentação",
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        labelPt: "Transporte",
      },
    ];

    it("preserva id e label quando a categoria persistida existe", () => {
      expect(
        resolveStoredNovaTxCategorySelection(
          {
            cat: "Alimentação",
            categoryTagId: "550e8400-e29b-41d4-a716-446655440000",
          },
          rows,
          { fallbackToFirst: true },
        ),
      ).toEqual({
        cat: "Alimentação",
        categoryTagId: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("reconcilia pelo label quando o id persistido não veio preenchido", () => {
      expect(
        resolveStoredNovaTxCategorySelection(
          {
            cat: "Transporte",
            categoryTagId: null,
          },
          rows,
          { fallbackToFirst: true },
        ),
      ).toEqual({
        cat: "Transporte",
        categoryTagId: "550e8400-e29b-41d4-a716-446655440001",
      });
    });

    it("cai para a primeira categoria quando não encontra match", () => {
      expect(
        resolveStoredNovaTxCategorySelection(
          {
            cat: "Inexistente",
            categoryTagId: null,
          },
          rows,
          { fallbackToFirst: true },
        ),
      ).toEqual({
        cat: "Alimentação",
        categoryTagId: "550e8400-e29b-41d4-a716-446655440000",
      });
    });
  });
});
