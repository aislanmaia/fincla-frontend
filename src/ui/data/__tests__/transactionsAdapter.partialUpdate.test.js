import { describe, expect, it } from "vitest";

import {
  buildEditBaselineFromUi,
  buildUpdateTransactionPayload,
  pickAmountAbsForTransactionEdit,
} from "../transactionsAdapter";

/**
 * O backend já trata "campo ausente = não mudou" (UpdateTransaction._merge_with_existing).
 * O que faltava era o cliente honrar esse contrato: mandando o pacote inteiro, o backend
 * precisa adivinhar o que mudou — e adivinha errado, porque `value` chega remontado como
 * (parcela editada × N) e `modality` chega derivado da contagem de parcelas.
 */
const compraParcelada = {
  tipo: "despesa",
  description: "Cafeteira",
  value: 99.99, // 33,33 × 3 — o que a tela remonta para uma compra de R$ 100,00 em 3x
  paymentMethodKey: "credito",
  categoryTagId: "tag-casa",
  detailTagIds: [],
  dateIso: "2026-05-10T00:00:00",
  cardId: 3,
  modality: "installment",
  installmentsCount: 3,
  recurring: false,
};

describe("buildUpdateTransactionPayload — atualização parcial", () => {
  it("sem baseline, mantém o comportamento anterior (pacote completo)", () => {
    const payload = buildUpdateTransactionPayload(compraParcelada);
    expect(payload).toMatchObject({
      type: "expense",
      description: "Cafeteira",
      value: 99.99,
      modality: "installment",
      installments_count: 3,
      card_id: 3,
    });
  });

  it("editando só a descrição, não envia value, modality nem installments_count", () => {
    const payload = buildUpdateTransactionPayload({
      ...compraParcelada,
      description: "Cafeteira italiana",
      baseline: compraParcelada,
    });

    expect(payload.description).toBe("Cafeteira italiana");
    expect(payload).not.toHaveProperty("value");
    expect(payload).not.toHaveProperty("modality");
    expect(payload).not.toHaveProperty("installments_count");
    expect(payload).not.toHaveProperty("card_id");
    expect(payload).not.toHaveProperty("type");
  });

  it("editando só a categoria, envia tag_ids e nada de cronograma", () => {
    const payload = buildUpdateTransactionPayload({
      ...compraParcelada,
      categoryTagId: "tag-transporte",
      baseline: compraParcelada,
    });

    expect(payload.tag_ids).toEqual(["tag-transporte"]);
    expect(payload).not.toHaveProperty("value");
    expect(payload).not.toHaveProperty("modality");
    expect(payload).not.toHaveProperty("description");
  });

  it("uma mudança real de valor continua sendo enviada", () => {
    const payload = buildUpdateTransactionPayload({
      ...compraParcelada,
      value: 120,
      baseline: compraParcelada,
    });

    expect(payload.value).toBe(120);
  });

  it("date vai sempre, porque ainda é obrigatório na API (fincla-api#91)", () => {
    const payload = buildUpdateTransactionPayload({
      ...compraParcelada,
      description: "Outro nome",
      baseline: compraParcelada,
    });

    expect(payload.date).toBe("2026-05-10T00:00:00");
  });

  it("tag_ids é comparado por conteúdo, não por ordem", () => {
    const payload = buildUpdateTransactionPayload({
      ...compraParcelada,
      detailTagIds: ["b", "a"],
      baseline: { ...compraParcelada, detailTagIds: ["a", "b"] },
    });

    expect(payload).not.toHaveProperty("tag_ids");
  });

  it("mudança de parcelas é enviada junto com o valor", () => {
    const payload = buildUpdateTransactionPayload({
      ...compraParcelada,
      value: 120,
      installmentsCount: 6,
      baseline: compraParcelada,
    });

    expect(payload.installments_count).toBe(6);
    expect(payload.value).toBe(120);
  });

  it("resíduo de ponto flutuante no total remontado não conta como mudança de valor", () => {
    // 33,34 × 3 = 100.02000000000001; o input devolve 100.02. Comparados com `===`,
    // o value ia junto e o backend voltava a adivinhar o que mudou (fincla-api#90).
    const emCentavos = { ...compraParcelada, value: 100.02 };
    const payload = buildUpdateTransactionPayload({
      ...emCentavos,
      value: 33.34 * 3,
      description: "Cafeteira nova",
      baseline: emCentavos,
    });

    expect(payload).not.toHaveProperty("value");
    expect(payload.description).toBe("Cafeteira nova");
  });
});

describe("pickAmountAbsForTransactionEdit — total remontado", () => {
  it("arredonda o produto parcela × N em centavos", () => {
    const total = pickAmountAbsForTransactionEdit({
      value: 33.34,
      installment_info: [{ amount: 33.34, total_installments: 3 }],
    });

    expect(total).toBe(100.02);
  });
});

describe("buildEditBaselineFromUi", () => {
  const parcelaUi = {
    id: 7,
    desc: "Cafeteira",
    val: -33.34,
    valAbsForEdit: 100.02,
    cat: "Casa",
    categoryTagId: "tag-casa",
    detailTagIds: ["tag-cozinha"],
    paymentMethodKey: "credito",
    cartaoId: 3,
    dateIsoForEdit: "2026-05-10T00:00:00",
    parcela: { total: 3, atual: 1 },
    rec: false,
  };

  it("descreve a compra parcelada como o servidor a entregou", () => {
    expect(buildEditBaselineFromUi(parcelaUi)).toEqual({
      tipo: "despesa",
      description: "Cafeteira",
      value: 100.02,
      paymentMethodKey: "credito",
      categoryTagId: "tag-casa",
      detailTagIds: ["tag-cozinha"],
      dateIso: "2026-05-10T00:00:00",
      cardId: 3,
      modality: "installment",
      installmentsCount: 3,
      recurring: false,
    });
  });

  it("um lançamento fora do cartão não ganha modalidade nem parcelas", () => {
    const baseline = buildEditBaselineFromUi({
      ...parcelaUi,
      paymentMethodKey: "pix",
      cartaoId: null,
      parcela: null,
    });

    expect(baseline).toMatchObject({
      paymentMethodKey: "pix",
      cardId: null,
      modality: null,
      installmentsCount: null,
    });
  });

  it("o baseline que ele constrói neutraliza uma edição só de categoria", () => {
    const payload = buildUpdateTransactionPayload({
      tipo: "despesa",
      description: parcelaUi.desc,
      value: 33.34 * 3, // a tela remonta o total com o resíduo do float
      paymentMethodKey: "credito",
      categoryTagId: "tag-lazer", // <- única mudança real
      detailTagIds: ["tag-cozinha"],
      dateIso: parcelaUi.dateIsoForEdit,
      cardId: 3,
      modality: "installment",
      installmentsCount: 3,
      recurring: false,
      baseline: buildEditBaselineFromUi(parcelaUi),
    });

    expect(payload).not.toHaveProperty("value");
    expect(payload).not.toHaveProperty("modality");
    expect(payload).not.toHaveProperty("installments_count");
    expect(payload).not.toHaveProperty("card_id");
    expect(payload.tag_ids).toContain("tag-lazer");
  });
});
