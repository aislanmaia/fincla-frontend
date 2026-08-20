import { describe, expect, it } from "vitest";
import {
  buildCreateTransactionPayload,
  buildUpdateTransactionPayload,
  mapApiTransactionToUi,
  pickDetailTagDisplayMapFromApiTransaction,
  pickDetailTagMetaMapFromApiTransaction,
  pickNonCategoryTagIdsFromApiTransaction,
} from "../transactionsAdapter.js";

const CAT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DET1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DET2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function tagStub(id, name, typeName, parentId = null) {
  return {
    id,
    name,
    color: null,
    is_default: false,
    is_active: true,
    organization_id: "org-1",
    sort_order: 0,
    is_onboarding_highlight: false,
    icon_key: null,
    parent_category_tag_id: parentId,
    tag_type: {
      id: `${typeName}-type`,
      name: typeName,
      description: null,
      is_required: false,
      max_per_transaction: null,
    },
  };
}

function minimalTransaction(overrides = {}) {
  return {
    id: 42,
    organization_id: "org-1",
    type: "expense",
    description: "Compra",
    value: 99.5,
    payment_method: "pix",
    date: "2026-03-15T12:00:00",
    status: "completed",
    recurring: false,
    created_at: "2026-03-15T12:00:00",
    updated_at: "2026-03-15T12:00:00",
    tags: {
      categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
      detalhe: [
        tagStub(DET1, "família", "detalhe", CAT_ID),
        tagStub(DET2, "semanal", "detalhe", CAT_ID),
      ],
    },
    ...overrides,
  };
}

describe("pickNonCategoryTagIdsFromApiTransaction", () => {
  it("exclui o id da tag de categoria e mantém ordem estável de detalhes", () => {
    const tx = minimalTransaction();
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1, DET2]);
  });

  it("ignora outras tags do tipo categoria no mesmo grupo (ex.: Transport vs Transporte)", () => {
    const transportCatId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const tx = minimalTransaction({
      tags: {
        categoria: [
          tagStub(CAT_ID, "Transporte", "categoria", null),
          tagStub(transportCatId, "Transport", "categoria", null),
        ],
        detalhe: [tagStub(DET1, "combustível", "detalhe", CAT_ID)],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });

  it("ignora detalhes cuja categoria pai não é a categoria principal da transação", () => {
    const otherCat = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const detOther = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Transporte", "categoria", null)],
        detalhe: [
          tagStub(DET1, "combustível", "detalhe", CAT_ID),
          tagStub(detOther, "outro", "detalhe", otherCat),
        ],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });

  it("deduplica ids repetidos em grupos diferentes", () => {
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Cat", "categoria", null)],
        detalhe: [tagStub(DET1, "a", "detalhe", CAT_ID)],
        outro: [tagStub(DET1, "a", "detalhe", CAT_ID)],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });

  it("com categoria legada sem id, devolve todos os ids das tags", () => {
    const tx = minimalTransaction({
      category: "Legado",
      tags: {
        detalhe: [tagStub(DET1, "x", "detalhe", null)],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });
});

describe("mapApiTransactionToUi — detailTagIds", () => {
  it("expõe detailTagIds alinhados ao pick", () => {
    const ui = mapApiTransactionToUi(minimalTransaction());
    expect(ui.detailTagIds).toEqual([DET1, DET2]);
    expect(ui.tags.map(String)).toContain("família");
  });

  it("expõe detailTagDisplayById com nome por id (chips no modal)", () => {
    const ui = mapApiTransactionToUi(minimalTransaction());
    expect(ui.detailTagDisplayById[DET1]).toBe("família");
    expect(ui.detailTagDisplayById[DET2]).toBe("semanal");
  });

  it("preserva categoria e detalhes inativos vindos do payload da transação", () => {
    const ui = mapApiTransactionToUi(minimalTransaction({
      category: "Alimentação",
      tags: {
        categoria: [{ ...tagStub(CAT_ID, "Alimentação", "categoria", null), is_active: false }],
        detalhe: [{ ...tagStub(DET1, "família", "detalhe", CAT_ID), is_active: false }],
      },
    }));

    expect(ui.categoryTagId).toBe(CAT_ID);
    expect(ui.categoryTagIsActive).toBe(false);
    expect(ui.detailTagIds).toEqual([DET1]);
    expect(ui.detailTagMetaById[DET1]).toEqual({ name: "família", isActive: false });
  });
});

describe("pickDetailTagDisplayMapFromApiTransaction", () => {
  it("usa placeholder curto quando a tag não tem nome", () => {
    const ghost = "c4eee2bc-d728-45a9-ae2e-8444af0006d5";
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          tagStub(DET1, "combustível", "detalhe", CAT_ID),
          {
            ...tagStub(ghost, "", "detalhe", CAT_ID),
            name: "",
          },
        ],
      },
    });
    const m = pickDetailTagDisplayMapFromApiTransaction(tx);
    expect(m[DET1]).toBe("combustível");
    expect(m[ghost]).toBe(`Tag ${ghost.slice(0, 8)}…`);
  });
});

describe("pickDetailTagMetaMapFromApiTransaction", () => {
  it("expõe nome e disponibilidade por id", () => {
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          { ...tagStub(DET1, "combustível", "detalhe", CAT_ID), is_active: false },
          tagStub(DET2, "semanal", "detalhe", CAT_ID),
        ],
      },
    });

    expect(pickDetailTagMetaMapFromApiTransaction(tx)).toEqual({
      [DET1]: { name: "combustível", isActive: false },
      [DET2]: { name: "semanal", isActive: true },
    });
  });

  // Regressão #100 (rodada 5 de review, achado 7): `pickTagNames` (linha) e
  // `pickDetailTagMetaMapFromApiTransaction` (modal) filtravam conjuntos
  // DIFERENTES — o meta map exigia `id` e deixava passar sem nome (com
  // placeholder); `pickTagNames` fazia o inverso (exigia nome, deixava
  // passar sem id). Agora os dois exigem `id` e usam o MESMO placeholder
  // pra nome vazio — uma tag sem nome (mas com id) aparece nos dois com
  // "Tag {id}…"; uma tag sem id (mas com nome) some dos dois.
  it("mesmo conjunto de tags nos dois call sites: sem nome ganha placeholder nos dois, sem id some dos dois", () => {
    const SEM_NOME = "12345678-90ab-4cde-8f01-234567890abc";
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          { ...tagStub(SEM_NOME, "", "detalhe", CAT_ID), name: "" },
          { ...tagStub(DET1, "tem nome mas sem id", "detalhe", CAT_ID), id: null },
        ],
      },
    });

    const mapped = mapApiTransactionToUi(tx);
    const placeholder = `Tag ${SEM_NOME.slice(0, 8)}…`;
    expect(mapped.tags).toEqual([placeholder]);
    expect(mapped.detailTagMetaById[SEM_NOME]?.name).toBe(placeholder);
    expect(mapped.tags).not.toContain("tem nome mas sem id");
  });
});

// Regressão #100 (rodada 3 de review, achado 4): a desambiguação por nome
// cru ("mercado (grocery)" vs "mercado") não cobre DUAS tags de verdade com
// o MESMO nome cru — ex.: duas tags "mensal" criadas pelo usuário (mesmo
// caso citado em `tagCatalogResolution.js`, "'mensal' sob Casa e sob
// Trabalho"). `rawName` e `label` são idênticos pras duas, a passada por
// nome cru não desempata nada — precisa de um desempate final
// garantidamente único, senão os chips leem igual E o React recebe key
// duplicada (`TransacoesPage.jsx`, `key={tag}`).
//
// Rodada 4: o desempate final NÃO usava o id inteiro (era ilegível — um
// pill de 11px sem largura garantida e a mesma string vazando pro CSV,
// achado 4), passou a usar índice de ocorrência.
//
// Rodada 5: o índice de ocorrência é POSICIONAL — `TransactionModel.tags`
// é uma relação `secondary` sem `order_by` no backend, então a MESMA tag
// podia ler "(1)" numa carga e "(2)" na seguinte (CSV grava strings
// diferentes pra mesma tag entre exportações; `novaTxModalInitStamp`, que
// hasheia `detailTagDisplayById`, muda e redispara o reset do modal).
// Agora usa um PREFIXO CURTO do id (8 chars) — estável em qualquer ordem,
// só depende da própria tag (achado 3, rodada 5 de review #100).
describe("desambiguação de tags detalhe com nome cru idêntico (achados 3/4/6, rodadas 3/4/5)", () => {
  it('duas tags do usuário chamadas "mensal" (sem hierarquia de categoria) desambiguam por prefixo curto e ESTÁVEL do id', () => {
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          tagStub(DET1, "mensal", "detalhe", null),
          tagStub(DET2, "mensal", "detalhe", null),
        ],
      },
    });

    const mapped = mapApiTransactionToUi(tx);
    expect(mapped.tags).toEqual([
      `mensal (${DET1.slice(0, 8)})`,
      `mensal (${DET2.slice(0, 8)})`,
    ]);
    // Sem colisão de key no React: os dois rótulos são únicos entre si.
    expect(new Set(mapped.tags).size).toBe(2);

    // `detailTagMetaById`/`detailTagDisplayById` usam a mesma desambiguação
    // (achado 5, rodada 3) — não podem voltar a mostrar "mensal"/"mensal"
    // ao editar.
    expect(mapped.detailTagMetaById[DET1].name).toBe(`mensal (${DET1.slice(0, 8)})`);
    expect(mapped.detailTagMetaById[DET2].name).toBe(`mensal (${DET2.slice(0, 8)})`);
  });

  // Regressão #100 (rodada 5, achado 3): a ordem em que o backend devolve
  // as tags no payload NÃO É garantida (sem `order_by`) — o mesmo par de
  // tags "mensal" precisa desambiguar pro MESMO texto independente da
  // ordem de chegada.
  it("o rótulo desambiguado não depende da ordem das tags no payload", () => {
    const txOrderAB = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          tagStub(DET1, "mensal", "detalhe", null),
          tagStub(DET2, "mensal", "detalhe", null),
        ],
      },
    });
    const txOrderBA = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          tagStub(DET2, "mensal", "detalhe", null),
          tagStub(DET1, "mensal", "detalhe", null),
        ],
      },
    });

    const labelForDet1InOrderAB = mapApiTransactionToUi(txOrderAB).detailTagMetaById[DET1].name;
    const labelForDet1InOrderBA = mapApiTransactionToUi(txOrderBA).detailTagMetaById[DET1].name;
    expect(labelForDet1InOrderAB).toBe(labelForDet1InOrderBA);
  });

  // Regressão #100 (rodada 4 de review, achado 3): `pickTagNames` (linha)
  // exclui ANTES a tag cujo nome cru bate com o nome cru da categoria;
  // `pickDetailTagMetaMapFromApiTransaction` (modal) não tem esse filtro.
  // Categoria custom "mercado" + tags "grocery" (→ "mercado") e "mercado"
  // (do usuário, raw igual à categoria): a tag "mercado" do usuário some da
  // LINHA por design (redundante com a categoria), mas "grocery" precisa
  // ler EXATAMENTE igual nos dois lugares — antes a linha via só "grocery"
  // sozinha (sem colisão pra desambiguar) e ficava "mercado", enquanto o
  // modal via as duas e desambiguava pra "mercado (grocery)".
  it('categoria custom "mercado" + detalhe "grocery"/"mercado": a tag "grocery" lê igual na linha e no modal', () => {
    const GROCERY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const USER_MERCADO = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "mercado", "categoria", null)],
        detalhe: [
          { ...tagStub(GROCERY, "grocery", "detalhe", CAT_ID), is_default: true },
          tagStub(USER_MERCADO, "mercado", "detalhe", CAT_ID),
        ],
      },
    });

    const mapped = mapApiTransactionToUi(tx);
    // "mercado" do usuário some da linha (redundante com a categoria) —
    // comportamento intencional, não é o que este teste cobre.
    expect(mapped.tags).toEqual(["mercado (grocery)"]);
    // A tag "grocery" precisa ler O MESMO texto no pré-preenchimento do
    // modal de edição.
    expect(mapped.detailTagMetaById[GROCERY].name).toBe("mercado (grocery)");
    expect(mapped.detailTagDisplayById[GROCERY]).toBe("mercado (grocery)");
  });

  // Regressão #100 (rodada 5 de review, achado 6): a passada do prefixo
  // curto do id pode, em teoria, colidir com uma tag de verdade cujo nome
  // JÁ É literalmente "rótulo (prefixo)" — duas "mensal" viram "mensal
  // (bbbbbbbb)"/"mensal (cccccccc)", e se existir uma terceira tag chamada
  // ao pé da letra "mensal (bbbbbbbb)", ela ficaria idêntica à primeira.
  // Uma rechecagem final troca pelo id INTEIRO só nas entradas que ainda
  // colidem depois do prefixo curto.
  it('residual: tag literal "mensal (prefixo)" colidindo com o prefixo curto de outra "mensal" ainda desambigua (rechecagem final)', () => {
    const LITERAL_COLLISION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          tagStub(DET1, "mensal", "detalhe", null),
          tagStub(DET2, "mensal", "detalhe", null),
          tagStub(LITERAL_COLLISION, `mensal (${DET1.slice(0, 8)})`, "detalhe", null),
        ],
      },
    });

    const mapped = mapApiTransactionToUi(tx);
    expect(mapped.tags).toHaveLength(3);
    // Nenhum dos três rótulos pode colidir entre si — key React única e
    // nenhuma tag "some" atrás de outra com o mesmo texto.
    expect(new Set(mapped.tags).size).toBe(3);
  });
});

describe("buildCreateTransactionPayload — detailTagIds", () => {
  it("inclui categoria e detalhes sem duplicar a categoria", () => {
    const payload = buildCreateTransactionPayload({
      organizationId: "org-1",
      tipo: "despesa",
      description: "Teste",
      value: 10,
      paymentMethodKey: "pix",
      categoryTagId: CAT_ID,
      detailTagIds: [DET1, CAT_ID, DET2],
      dateIso: "2026-01-01T12:00:00",
    });
    expect(payload.tag_ids).toEqual([CAT_ID, DET1, DET2]);
  });

  it("sem detalhes mantém só a categoria", () => {
    const payload = buildCreateTransactionPayload({
      organizationId: "org-1",
      tipo: "despesa",
      description: "Teste",
      value: 10,
      paymentMethodKey: "pix",
      categoryTagId: CAT_ID,
      detailTagIds: null,
      dateIso: "2026-01-01T12:00:00",
    });
    expect(payload.tag_ids).toEqual([CAT_ID]);
  });
});

describe("buildUpdateTransactionPayload — detailTagIds", () => {
  it("quando há categoryTagId, envia tag_ids completos", () => {
    const payload = buildUpdateTransactionPayload({
      tipo: "despesa",
      description: "Atualizado",
      value: 20,
      paymentMethodKey: "pix",
      categoryTagId: CAT_ID,
      detailTagIds: [DET2],
      dateIso: "2026-01-02T12:00:00",
      recurring: false,
    });
    expect(payload.tag_ids).toEqual([CAT_ID, DET2]);
  });

  it("sem categoryTagId não define tag_ids", () => {
    const payload = buildUpdateTransactionPayload({
      tipo: "despesa",
      description: "X",
      value: 1,
      paymentMethodKey: "pix",
      categoryTagId: null,
      detailTagIds: [DET1],
      dateIso: "2026-01-02T12:00:00",
    });
    expect(payload.tag_ids).toBeUndefined();
  });
});
