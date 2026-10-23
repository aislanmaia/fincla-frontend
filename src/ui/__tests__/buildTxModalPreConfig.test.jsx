// @vitest-environment jsdom
/**
 * Editar pela lista: o pré-config nasce da linha da lista (sem refetch). Se ele não disser que a categoria do
 * lançamento foi apagada, o formulário não a encontra entre as ativas e cai na primeira categoria: salvar uma
 * correção de descrição trocava a categoria em silêncio.
 */
import { describe, expect, it } from "vitest";

import { buildTxModalPreConfig } from "../App.jsx";

const row = (over = {}) => ({ id: 203, desc: "Feira", cat: "QA Cat", categoryTagId: "6dd9306c-dae1-4f02-8bbf-ea73887f14ff", categoryTagIsActive: true, val: -25, type: "expense", date: "20/10/2026", dateIsoForEdit: "2026-10-20", tags: [], detailTagIds: [], ...over });

describe("buildTxModalPreConfig", () => {
  it("repassa que a categoria foi apagada, para o formulário mantê-la como 'indisponível'", () => {
    expect(buildTxModalPreConfig(row({ categoryTagIsActive: false })).categoryTagIsActive).toBe(false);
  });

  it("categoria ativa continua ativa, e a ausência do campo não a desativa", () => {
    expect(buildTxModalPreConfig(row()).categoryTagIsActive).toBe(true);
    expect(buildTxModalPreConfig(row({ categoryTagIsActive: undefined })).categoryTagIsActive).toBe(true);
  });
});
