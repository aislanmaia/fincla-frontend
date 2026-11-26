// A fronteira da Conciliar fatura (fincla-api#555) sobre a fixture de contrato, cópia byte a byte
// de `fincla-api/docs/contracts/card_invoice_import.example.json` (presa aos modelos de lá).
import { describe, expect, it } from 'vitest';

import contract from '../__fixtures__/card_invoice_import.example.json';
import {
  type CardInvoiceUndoPreview,
  invoiceDraftInProgressOf,
  isCardInvoiceResponse,
  normalizeCardInvoiceImport,
  normalizeCardInvoiceImportListItem,
  normalizeCardInvoiceLeftovers,
  normalizeCardInvoiceTotalCheck,
  normalizeCardInvoiceUndoPreview,
  normalizeInvoiceCandidate,
  normalizeInvoiceEntry,
} from '../cardInvoiceImports';
import { normalizeStatementUndoPreview } from '../statementImports';

const KEYS = [
  'id', 'position', 'date', 'bank_description', 'amount', 'section', 'installment', 'next_installments', 'foreign_amount',
  'card_last4', 'classification', 'answer', 'confirmed', 'answerable', 'suggested_transaction_id', 'paired_transaction_id',
  'fincla_transaction', 'value_change', 'next_adjustment', 'value_locked',
  // A compra nova (#557).
  'description', 'transaction_type', 'category_tag_id', 'suggested_category_tag_id', 'detail_tag_ids', 'installments_scope',
  'new_purchase', 'created_transaction_id',
  // Encargos, tarifas e estornos (#558).
  'charge_group_id', 'addable',
  // Dúvidas e compras em outra fatura (#559).
  'suggested_answer', 'other_invoice', 'movable', 'series_movable', 'move_refusal', 'candidates', 'suggestion_basis',
  // O Repasse de IOF somado em vários lançamentos do Fincla (#574).
  'split_pair',
];

describe('normalizeCardInvoiceImport', () => {
  it('a fixture traz todos os campos que a tela lê em cada lançamento', () => {
    for (const entry of contract.draft.entries) expect(Object.keys(entry).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(contract.entry).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(contract.entry_new).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(contract.entry_installment).sort()).toEqual([...KEYS].sort());
    for (const entry of contract.new_purchases_draft.entries) expect(Object.keys(entry).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(contract.entry_doubt).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(contract.entry_move).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(contract.entry_iof_split).sort()).toEqual([...KEYS].sort());
  });

  it('#574: o Repasse de IOF somado em vários do Fincla (entry_iof_split): as transações e a soma em número', () => {
    const entry = normalizeInvoiceEntry(contract.entry_iof_split as never);
    expect(entry.answer).toBe('pair_split');
    expect(entry.split_pair?.transaction_ids).toEqual([30, 31]);
    expect(entry.split_pair?.transactions.map((t) => [t.id, t.value, t.currency])).toEqual([[30, 0.92, 'BRL'], [31, 0.97, 'BRL']]);
    expect(entry.split_pair?.total).toEqual({ amount: -1.89, currency: 'BRL' });
    expect(normalizeInvoiceEntry(contract.entry as never).split_pair).toBeNull();
  });

  it('converte o dinheiro em número + moeda, com o sinal do sentido do dinheiro', () => {
    const draft = normalizeCardInvoiceImport(contract.draft as unknown as Record<string, unknown>);
    expect(draft.kind).toBe('card_invoice');
    const loja = draft.entries.find((e) => e.bank_description === 'LOJA DO BAIRRO 05/12')!;
    expect(loja.amount).toBe(-108.3);
    expect(loja.currency).toBe('BRL');
    expect(loja.installment).toEqual({ number: 5, count: 12 });
    expect(loja.next_installments).toHaveLength(7);
    expect(loja.next_installments[0]).toEqual({ number: 6, amount: 108.27, currency: 'BRL' });
    expect(loja.value_change).toEqual({ from: 108.33, to: 108.3, currency: 'BRL' });
    expect(loja.fincla_transaction?.value).toBe(108.33);
    expect(loja.fincla_transaction?.purchase_date).toBe('2026-07-14');
    expect(draft.invoice.total).toEqual({ amount: 966.35, currency: 'BRL' });
    expect(draft.difference_now).toEqual({ bank: 2402.92, fincla: 2464.32, difference: -61.4, currency: 'BRL' });
    expect(draft.bank_summary.payment).toEqual({ amount: { amount: -2900, currency: 'BRL' }, date: '2026-11-10' });
    expect(draft.final_difference).toBeNull();
    expect(draft.file_name).toBe(contract.draft.file_name);
  });

  it('sem nome de arquivo, file_name fica null', () => {
    const raw = JSON.parse(JSON.stringify(contract.draft));
    delete raw.file_name;
    expect(normalizeCardInvoiceImport(raw).file_name).toBeNull();
  });

  it('o que não sabemos continua null, nunca zero', () => {
    const raw = JSON.parse(JSON.stringify(contract.draft));
    raw.difference_now = { bank: raw.difference_now.bank, fincla: null, difference: null };
    raw.invoice.total = null;
    const draft = normalizeCardInvoiceImport(raw);
    expect(draft.difference_now.fincla).toBeNull();
    expect(draft.difference_now.difference).toBeNull();
    expect(draft.invoice.total).toBeNull();
  });

  it('a concluída traz a diferença registrada', () => {
    const done = normalizeCardInvoiceImport(contract.concluded as unknown as Record<string, unknown>);
    expect(done.status).toBe('concluded');
    // Com as dúvidas respondidas e a compra movida (#559), sobra a Assinatura mantida em Sobrando no
    // Fincla (#560): a fatura gravada fica R$ 61,00 acima do banco.
    expect(done.final_difference).toEqual({ amount: -61, currency: 'BRL' });
    expect(done.entries.every((e) => !e.answerable)).toBe(true);
  });
});

describe('o envio pela área da conta', () => {
  it('reconhece a resposta de fatura pelo kind (o extrato não tem kind)', () => {
    expect(isCardInvoiceResponse(contract.draft)).toBe(true);
    expect(isCardInvoiceResponse({ id: 'x', status: 'draft' })).toBe(false);
  });

  it('lê o rascunho em andamento da 409', () => {
    const error = { response: { status: 409, data: { detail: contract.draft_in_progress } } };
    expect(invoiceDraftInProgressOf(error)).toEqual({
      importId: contract.draft_in_progress.import_id,
      creditCardId: contract.draft_in_progress.credit_card_id,
      creditCardPublicId: contract.draft_in_progress.credit_card_public_id,
      message: contract.draft_in_progress.message,
    });
    expect(invoiceDraftInProgressOf({ response: { status: 409, data: { detail: { reason: 'draft_in_progress', import_id: 'x' } } } })).toBeNull();
  });
});

// Segunda entrega (#556): desfazer, rascunho, "Faturas conciliadas" e reimportação.
describe('desfazer, rascunho e reimportação (#556)', () => {
  const raw = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

  it('o detalhe traz file_check, undone_at, latest_concluded e já conferidos no resumo', () => {
    const draft = normalizeCardInvoiceImport(raw(contract.draft));
    expect(draft.file_check).toEqual({ status: 'new', import_id: null, concluded_at: null });
    expect(draft.undone_at).toBeNull();
    expect(draft.latest_concluded).toBe(false);
    expect(draft.summary.already_reconciled).toBe(0);
    expect(normalizeCardInvoiceImport(raw(contract.concluded)).latest_concluded).toBe(true);
  });

  it('sem file_check (backend anterior), o arquivo conta como novo', () => {
    const old = raw(contract.draft);
    delete old.file_check;
    delete (old.summary as Record<string, unknown>).already_reconciled;
    const draft = normalizeCardInvoiceImport(old);
    expect(draft.file_check.status).toBe('new');
    expect(draft.summary.already_reconciled).toBe(0);
  });

  it('reimportação: o arquivo já conciliado e os já conferidos (reconciled), só leitura', () => {
    for (const entry of contract.reimport.entries) expect(Object.keys(entry).sort()).toEqual([...KEYS].sort());
    const again = normalizeCardInvoiceImport(raw(contract.reimport));
    expect(again.file_check).toEqual(contract.reimport.file_check);
    // Todos os 20 voltam como já conferidos: os 4 pares, as 3 dúvidas escolhidas e a compra movida
    // (#559), as 8 transações criadas (#557, #558) e os 4 encargos somados (#558).
    expect(again.summary.already_reconciled).toBe(20);
    const conferred = again.entries.filter((e) => e.classification === 'reconciled');
    expect(conferred).toHaveLength(20);
    for (const entry of conferred) {
      expect(entry.answer).toBe('reconciled');
      expect(entry.confirmed).toBe(true);
      expect(entry.answerable).toBe(false);
      expect(entry.fincla_transaction?.id).toBe(entry.paired_transaction_id);
    }
  });

  it('a lista: o detalhe sem entries, com o dinheiro convertido e null que continua null', () => {
    const items = contract.list.imports.map((i) => normalizeCardInvoiceImportListItem(raw(i)));
    expect(items.map((i) => i.status)).toEqual(['draft', 'undone', 'concluded']);
    const [draft, undone, concluded] = items;
    expect(draft.current_step).toBe('doubt');
    expect(draft.final_difference).toBeNull();
    expect(draft.expires_at).toBe(contract.list.imports[0].expires_at);
    expect(draft.summary.already_reconciled).toBe(20);
    expect(draft.changed_since_read).toBe(false);
    expect(undone.undone_at).toBe(contract.list.imports[1].undone_at);
    expect(undone.final_difference).toEqual({ amount: -61, currency: 'BRL' });
    expect(concluded.latest_concluded).toBe(true);
    expect(concluded.invoice.total).toEqual({ amount: 2463.92, currency: 'BRL' });
    expect(concluded.difference_now).toEqual({ bank: 2402.92, fincla: 2463.92, difference: -61, currency: 'BRL' });
    expect(items.filter((i) => i.latest_concluded)).toHaveLength(1);
  });

  it('a prévia do desfazer usa as peças do extrato: o valor que volta vira número + moeda', () => {
    const preview = normalizeStatementUndoPreview(raw(contract.undo_preview) as never);
    expect(preview.can_undo).toBe(true);
    const loja = preview.to_restore.find((r) => r.entity_id === '7')!;
    expect(loja.edited_after).toBe(true);
    expect(loja.changed_fields).toEqual(['description']);
    expect(loja.value_back).toBe(108.33);
    expect(loja.value_back_currency).toBe('BRL');
    expect(preview.to_restore.find((r) => r.entity_id === '1')!.value_back).toBeNull();
    const refused = normalizeStatementUndoPreview(raw(contract.undo_preview_refused) as never);
    expect(refused.refusal?.code).toBe('not_latest');
    // Recusa por fatura paga anterior (QA F3 BUG-01): a recusa diz qual fatura desmarcar.
    const paid = normalizeStatementUndoPreview(raw(contract.undo_preview_refused_paid) as never) as CardInvoiceUndoPreview;
    expect(paid.refusal).toMatchObject({ code: 'invoice_paid', invoice_year: 2026, invoice_month: 12 });
    expect(paid.refusal?.message).toMatch(/^A fatura de dezembro\/2026 foi paga depois da conciliação\./);
  });

  it('a desfeita: status undone, undone_at e o que o desfazer apagou', () => {
    const undone = normalizeCardInvoiceImport(raw(contract.undone));
    expect(undone.status).toBe('undone');
    expect(undone.undone_at).toBe(contract.undone.undone_at);
    // As 7 transações que a conclusão criou (#557 e os encargos, tarifas e estornos da #558; o Repasse de IOF
    // ficou somado nos IOFs do Fincla, #574) são apagadas.
    expect((contract.undone as { deleted_transactions: number }).deleted_transactions).toBe(7);
  });
});

// Terceira entrega (#557): compras novas, à vista e parceladas.
describe('compras novas (#557)', () => {
  const raw = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

  it('à vista: o formulário (descrição, tipo travado, categoria, etiquetas) e sem compra parcelada', () => {
    const padaria = normalizeCardInvoiceImport({ ...raw(contract.draft), entries: [raw(contract.entry_new)] }).entries[0];
    expect(padaria.classification).toBe('new');
    expect(padaria.answer).toBe('create');
    expect(padaria.description).toBe('Padaria');
    expect(padaria.transaction_type).toBe('expense');
    expect(padaria.category_tag_id).toBe(contract.entry_new.category_tag_id);
    expect(padaria.detail_tag_ids).toEqual(contract.entry_new.detail_tag_ids);
    expect(padaria.installments_scope).toBeNull();
    expect(padaria.new_purchase).toBeNull();
    expect(padaria.created_transaction_id).toBeNull();
  });

  it('parcelada: a compra inteira, cada parcela na sua fatura, com o dinheiro convertido', () => {
    const draft = normalizeCardInvoiceImport(raw(contract.new_purchases_draft));
    const loja = draft.entries.find((e) => e.bank_description === 'LOJA DO BAIRRO 03/06')!;
    expect(loja.installments_scope).toBe('full');
    expect(loja.new_purchase?.installments_count).toBe(6);
    expect(loja.new_purchase?.total_amount).toEqual({ amount: 599.4, currency: 'BRL' });
    expect(loja.new_purchase?.installments).toHaveLength(6);
    expect(loja.new_purchase?.installments[0]).toEqual({
      number: 1, amount: 99.9, currency: 'BRL', invoice_year: 2026, invoice_month: 11, from_bank: false, invoice_paid: false,
    });
    expect(loja.new_purchase?.installments[2].from_bank).toBe(true);
    const moveis = normalizeCardInvoiceImport({ ...raw(contract.draft), entries: [raw(contract.entry_installment)] }).entries[0];
    expect(moveis.installments_scope).toBe('from_current');
  });

  it('o resumo conta as novas, as sem descrição (bloqueio) e as sem categoria', () => {
    const draft = normalizeCardInvoiceImport(raw(contract.new_purchases_draft));
    // A primeira compra (MERCADO BOA VISTA) está em outra fatura já paga (#559): começa sem resposta.
    expect(draft.summary.to_create).toBe(4);
    expect(draft.summary.missing_description).toBe(1);
    expect(draft.summary.uncategorized).toBe(4);
    expect(draft.blockers).toEqual([
      { code: 'unanswered', count: 1, step: null },
      { code: 'missing_description', count: 1, step: null },
      { code: 'unconfirmed_creates', count: 4, step: 'new' },
      { code: 'undecided_leftovers', count: 3, step: 'leftover' },
    ]);
    expect(draft.summary).toMatchObject({ unconfirmed_creates: 4, leftovers: 3, leftovers_undecided: 3, leftovers_waiting: 0 });
    expect(draft.can_conclude).toBe(false);
  });

  it('sem os campos novos (backend anterior), a compra nova fica vazia e o resumo em zero', () => {
    const old = raw(contract.draft);
    const entry = (old.entries as Record<string, unknown>[])[0];
    for (const key of ['description', 'transaction_type', 'category_tag_id', 'detail_tag_ids', 'installments_scope', 'new_purchase']) delete entry[key];
    const summary = old.summary as Record<string, unknown>;
    for (const key of ['to_create', 'missing_description', 'uncategorized']) delete summary[key];
    const draft = normalizeCardInvoiceImport(old);
    expect(draft.entries[0].description).toBe('');
    expect(draft.entries[0].transaction_type).toBe('expense');
    expect(draft.entries[0].detail_tag_ids).toEqual([]);
    expect(draft.entries[0].new_purchase).toBeNull();
    expect(draft.summary).toMatchObject({ to_create: 0, missing_description: 0, uncategorized: 0 });
  });
});

// Quarta entrega (#558): encargos, tarifas e estornos, com o grupo de encargos.
describe('encargos, tarifas e estornos (#558)', () => {
  const raw = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

  it('o grupo de encargos: a Soma negativa, a transação que bate e os lançamentos dele', () => {
    const draft = normalizeCardInvoiceImport(raw(contract.draft));
    expect(draft.charge_groups).toHaveLength(1);
    const [group] = draft.charge_groups;
    expect(group.total).toBe(-12.59);
    expect(group.currency).toBe('BRL');
    expect(group.answer).toBe('pair_sum');
    expect(group.confirmed).toBe(false);
    expect(group.suggested_transaction_id).toBe(group.fincla_transaction?.id);
    expect(group.fincla_transaction?.value).toBe(12.59);
    expect(group.fincla_transaction?.description).toBe('Encargos do cartão');
    const members = draft.entries.filter((e) => e.charge_group_id === group.id);
    expect(members.map((e) => e.id)).toEqual(group.entry_ids);
    expect(members.every((e) => e.answer === 'pair_sum' && e.section === 'charges')).toBe(true);
    expect(members.reduce((sum, e) => sum + e.amount, 0)).toBeCloseTo(group.total, 2);
    expect(draft.summary.summed_charges).toBe(members.length);
  });

  it('crédito vira estorno e Adicionar vale; o repasse de IOF é um lançamento próprio, fora do grupo', () => {
    const draft = normalizeCardInvoiceImport(raw(contract.draft));
    const charges = draft.entries.filter((e) => e.classification === 'charges' && !e.charge_group_id);
    const estorno = charges.find((e) => e.bank_description === 'ESTORNO LOJA MODA')!;
    expect(estorno.amount).toBe(45);
    expect(estorno.transaction_type).toBe('refund');
    expect(estorno.answer).toBe('create');
    expect(estorno.addable).toBe(true);
    const iof = charges.find((e) => e.bank_description === 'Repasse de IOF')!;
    expect(iof.section).toBe('international');
    expect(iof.charge_group_id).toBeNull();
  });

  it('"Não, adicionar cada um" (charge_group_each): o grupo e os lançamentos create, a soma sai do resumo', () => {
    const each = normalizeCardInvoiceImport(raw(contract.charge_group_each));
    const [group] = each.charge_groups;
    expect(group.answer).toBe('create');
    expect(group.confirmed).toBe(true);
    expect(group.paired_transaction_id).toBeNull();
    // A transação somada continua à vista (a tela a mostra cinza listrada com Não registrar).
    expect(group.fincla_transaction?.id).toBe(group.suggested_transaction_id);
    expect(each.entries.filter((e) => e.charge_group_id === group.id).every((e) => e.answer === 'create')).toBe(true);
    expect(each.summary.summed_charges).toBe(0);
    expect(each.summary.to_create).toBe(11);
  });

  it('na concluída nada responde e nada é adicionável', () => {
    const done = normalizeCardInvoiceImport(raw(contract.concluded));
    expect(done.charge_groups[0]).toMatchObject({ answerable: false, addable: false, answer: 'pair_sum' });
    expect(done.entries.every((e) => !e.addable)).toBe(true);
  });

  it('sem os campos da #558 (backend anterior): sem grupo, addable segue o answerable, summed_charges 0', () => {
    const old = raw(contract.draft);
    delete old.charge_groups;
    for (const entry of old.entries as Record<string, unknown>[]) {
      delete entry.charge_group_id;
      delete entry.addable;
    }
    delete (old.summary as Record<string, unknown>).summed_charges;
    const draft = normalizeCardInvoiceImport(old);
    expect(draft.charge_groups).toEqual([]);
    expect(draft.entries.every((e) => e.charge_group_id === null && e.addable === e.answerable)).toBe(true);
    expect(draft.summary.summed_charges).toBe(0);
  });
});

// Quinta entrega (#559): dúvidas, a busca "Procure no Fincla" e as compras em outra fatura.
describe('dúvidas e compras em outra fatura (#559)', () => {
  const raw = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const one = (entry: unknown) => normalizeCardInvoiceImport({ ...raw(contract.draft), entries: [raw(entry)] }).entries[0];

  it('a dúvida começa sem resposta, com as opções ao vivo e a fatura de cada uma', () => {
    const draft = normalizeCardInvoiceImport(raw(contract.draft));
    const doubts = draft.entries.filter((e) => e.classification === 'doubt');
    expect(doubts).toHaveLength(3);
    for (const doubt of doubts) {
      expect(doubt.answer).toBeNull();
      expect(doubt.confirmed).toBe(false);
      expect(doubt.suggested_answer).toBeNull();
      expect(doubt.candidates.length).toBeGreaterThan(0);
    }
    const posto = doubts.find((e) => e.bank_description === 'POSTO CENTRAL')!;
    expect(posto.candidates).toHaveLength(1);
    expect(posto.candidates[0]).toMatchObject({ id: 27, value: 150.4, currency: 'BRL', differences: ['amount'], taken_by_entry_id: null });
    expect(posto.candidates[0].invoice).toEqual({ id: draft.invoice.id, year: 2026, month: 12, status: 'open' });
    expect(draft.summary.unanswered).toBe(3);
    expect(draft.summary.to_move).toBe(1);
  });

  it('a dúvida respondida: a escolhida é a ligada; a já escolhida por outro vem marcada na busca', () => {
    const uber = one(contract.entry_doubt);
    expect(uber.answer).toBe('pair');
    expect(uber.fincla_transaction?.id).toBe(uber.paired_transaction_id);
    expect(uber.candidates.map((c) => c.id)).toEqual([25, 26]);
    const results = contract.search.results.map((r) => one({ ...raw(contract.entry_doubt), candidates: [r] }).candidates[0]);
    expect(results.map((r) => r.taken_by_entry_id)).toEqual([null, contract.entry_doubt.id]);
    expect(results[0].value).toBe(23.47);
  });

  it('a compra em outra fatura: a sugestão, a fatura de onde vem e o que dá para mover agora', () => {
    const cafe = one(contract.entry_move);
    expect(cafe.classification).toBe('other_invoice');
    expect(cafe.suggested_answer).toBe('move');
    expect(cafe.other_invoice).toEqual({ id: 6, year: 2027, month: 1, status: 'open' });
    expect(cafe.movable).toBe(true);
    expect(cafe.series_movable).toBe(false);
    expect(cafe.move_refusal).toBeNull();
    expect(cafe.candidates).toEqual([]);
  });

  it('a outra fatura já paga: começa sem resposta, mover desligado com o motivo que nomeia a fatura', () => {
    const mercado = normalizeCardInvoiceImport(raw(contract.new_purchases_draft)).entries[0];
    expect(mercado.classification).toBe('other_invoice');
    expect(mercado.answer).toBeNull();
    expect(mercado.movable).toBe(false);
    expect(mercado.move_refusal).toMatchObject({ code: 'other_invoice_paid', invoice_year: 2026, invoice_month: 12 });
    expect(mercado.move_refusal?.message).toMatch(/dezembro\/2026 já foi paga/);
  });

  it('cada opção e resultado da busca traz o que dá para mover e a sugestão calculada para ela', () => {
    const [ahead, here, behind] = contract.search_neighbours.results.map((r) => normalizeInvoiceCandidate(raw(r)));
    // A 06/12 da série uma fatura à frente. A busca parte de um lançamento à vista (POSTO CENTRAL); com a
    // QA F5 BUG-02 "esta e as próximas" é só para a parcela do próprio banco: só esta.
    expect(ahead).toMatchObject({ id: 8, suggested_answer: 'move', movable: true, series_movable: false, move_refusal: null });
    expect(ahead.suggestion_basis).toEqual({
      previous: { number: 5, invoice: { id: 1, year: 2026, month: 12, status: 'open' } },
      next: { number: 7, invoice: { id: 7, year: 2027, month: 2, status: 'open' } },
    });
    // Nesta fatura: é "Sim, é esta", nada a mover.
    expect(here).toMatchObject({ id: 7, suggested_answer: null, movable: false, series_movable: false, move_refusal: null, suggestion_basis: null });
    // Série uma fatura atrás: só esta, sem motivo.
    expect(behind).toMatchObject({ id: 6, suggested_answer: 'move', movable: true, series_movable: false, move_refusal: null });
    expect(behind.suggestion_basis?.previous).toEqual({ number: 3, invoice: { id: 4, year: 2026, month: 10, status: 'open' } });
    // As opções da dúvida, nesta fatura.
    const uber = one(contract.entry_doubt);
    expect(uber.candidates.every((c) => c.suggested_answer === null && !c.movable && c.suggestion_basis === null)).toBe(true);
    // O lançamento à vista do passo 2: sem base de sugestão.
    expect(one(contract.entry_move).suggestion_basis).toBeNull();
  });

  it('a base da sugestão: parcela vizinha fora das faturas do cartão (invoice null) continua null', () => {
    const basis = { previous: null, next: { number: 7, invoice: null } };
    const candidate = normalizeInvoiceCandidate({ ...raw(contract.search_neighbours.results[0]), suggestion_basis: basis, invoice: null });
    expect(candidate.suggestion_basis).toEqual(basis);
    expect(candidate.invoice).toBeNull();
    const old = raw(contract.search_neighbours.results[0]);
    for (const key of ['suggested_answer', 'movable', 'series_movable', 'move_refusal', 'suggestion_basis']) delete old[key];
    expect(normalizeInvoiceCandidate(old)).toMatchObject({ suggested_answer: null, movable: false, series_movable: false, move_refusal: null, suggestion_basis: null });
  });

  it('a prévia do desfazer do cartão: a fatura para onde a compra movida volta (invoice_back)', () => {
    const preview = normalizeCardInvoiceUndoPreview(raw(contract.undo_preview));
    const moved = preview.to_restore.filter((r) => r.invoice_back);
    expect(moved.map((r) => [r.description, r.invoice_back])).toEqual([['Cafeteria', { id: 6, year: 2027, month: 1, status: 'open' }]]);
    expect(preview.to_restore.find((r) => r.entity_id === '7')!.value_back).toBe(108.33);
    const old = raw(contract.undo_preview);
    for (const r of old.to_restore as Record<string, unknown>[]) delete r.invoice_back;
    expect(normalizeCardInvoiceUndoPreview(old).to_restore.every((r) => r.invoice_back === null)).toBe(true);
  });

  it('a leitura desatualizada (stale_draft): changed_since_read, o bloqueio e nada a concluir', () => {
    const stale = normalizeCardInvoiceImport(raw(contract.stale_draft));
    expect(stale.changed_since_read).toBe(true);
    expect(stale.can_conclude).toBe(false);
    expect(stale.blockers).toEqual([
      { code: 'undecided_leftovers', count: 11, step: 'leftover' },
      { code: 'changed_since_read', count: 1, step: null },
    ]);
    expect(normalizeCardInvoiceImport(raw(contract.draft)).changed_since_read).toBe(false);
  });

  it('sem os campos da #559 (backend anterior): sem opções, nada a mover, to_move 0', () => {
    const old = raw(contract.draft);
    for (const entry of old.entries as Record<string, unknown>[]) {
      for (const key of ['suggested_answer', 'other_invoice', 'movable', 'series_movable', 'move_refusal', 'candidates']) delete entry[key];
    }
    delete (old.summary as Record<string, unknown>).to_move;
    delete old.changed_since_read;
    const draft = normalizeCardInvoiceImport(old);
    expect(draft.entries.every((e) => e.candidates.length === 0 && !e.movable && e.other_invoice === null)).toBe(true);
    expect(draft.summary.to_move).toBe(0);
    expect(draft.changed_since_read).toBe(false);
  });
});

describe('Sobrando no Fincla e Conferir o total (#560)', () => {
  const asRaw = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

  it('a lista do que sobrou: a transação em número, a decisão, a dica e a fatura seguinte', () => {
    const left = normalizeCardInvoiceLeftovers(asRaw(contract.leftovers));
    expect(left.items).toHaveLength(1);
    const [item] = left.items;
    expect(item.transaction).toMatchObject({ id: 32, description: 'Assinatura', value: 61, currency: 'BRL', type: 'expense' });
    expect(item).toMatchObject({ action: null, movable: true, deletable: true, move_refusal: null, delete_refusal: null });
    expect(item.hint?.code).toBe('maybe_next_invoice');
    expect(left.waiting_transactions).toBe(0);
    expect(left.next_invoice).toEqual({ id: 6, year: 2027, month: 1, status: 'open' });
    expect(normalizeCardInvoiceLeftovers(asRaw(contract.leftover_kept)).items[0].action).toBe('keep');
  });

  it('o total: banco, Fincla e a diferença em número; as causas com o passo; null continua null', () => {
    const check = normalizeCardInvoiceTotalCheck(asRaw(contract.total_check));
    expect(check.bank).toEqual({ amount: 2402.92, currency: 'BRL' });
    expect(check.fincla).toEqual({ amount: 2463.92, currency: 'BRL' });
    expect(check.difference).toEqual({ amount: -61, currency: 'BRL' });
    expect(check.matches).toBe(false);
    expect(check.causes).toEqual([{
      code: 'kept_leftover', step: 'leftover', description: 'Assinatura', amount: { amount: 61, currency: 'BRL' },
      effect: { amount: -61, currency: 'BRL' }, date: '2026-11-25', entry_id: null, charge_group_id: null, transaction_id: 32,
    }]);
    expect(check.bank_summary.financed_balance).toEqual({ amount: 100, currency: 'BRL' });
    const unknown = normalizeCardInvoiceTotalCheck({ ...asRaw(contract.total_check), fincla: null, difference: null });
    expect(unknown.fincla).toBeNull();
    expect(unknown.difference).toBeNull();
  });

  it('as compras novas sem confirmar seguram o concluir, um bloqueio por passo; confirmadas, libera', () => {
    const pending = normalizeCardInvoiceImport(asRaw(contract.draft_unconfirmed));
    expect(pending.blockers).toEqual([
      { code: 'unconfirmed_creates', count: 3, step: 'charges' },
      { code: 'unconfirmed_creates', count: 3, step: 'new' },
    ]);
    expect(pending.summary.unconfirmed_creates).toBe(6);
    expect(pending.summary.leftovers_kept).toBe(1);
    const done = normalizeCardInvoiceImport(asRaw(contract.creates_confirmed));
    expect(done.blockers).toEqual([]);
    expect(done.can_conclude).toBe(true);
  });
});

describe('next_adjustment (#561)', () => {
  it('normaliza a lista das próximas parcelas e a diferença da compra', () => {
    const on = normalizeInvoiceEntry(contract.entry as never).next_adjustment;
    expect(on?.adjust).toBe(true);
    expect(on?.installments).toHaveLength(7);
    expect(on?.installments[0]).toEqual({
      number: 6, transaction_id: 8, from: { amount: 108.33, currency: 'BRL' }, to: { amount: 108.27, currency: 'BRL' },
      invoice: { id: 6, year: 2027, month: 1, status: 'open' }, locked: null,
    });
    expect(on?.purchase_difference).toEqual({ amount: 0, currency: 'BRL' });
    const off = normalizeInvoiceEntry(contract.entry_adjust_off as never).next_adjustment;
    expect(off?.adjust).toBe(false);
    expect(off?.purchase_difference).toEqual({ amount: 0.42, currency: 'BRL' });
  });

  it('null fica null; dinheiro ausente vira null (não sabemos), nunca zero', () => {
    expect(normalizeInvoiceEntry({ ...contract.entry, next_adjustment: null } as never).next_adjustment).toBeNull();
    const raw = structuredClone(contract.entry_adjust_off) as { next_adjustment: Record<string, unknown> & { installments: Record<string, unknown>[] } };
    raw.next_adjustment.purchase_difference = null;
    raw.next_adjustment.installments[0].to = null;
    raw.next_adjustment.installments[0].locked = 'invoice_paid';
    const adj = normalizeInvoiceEntry(raw as never).next_adjustment;
    expect(adj?.purchase_difference).toBeNull();
    expect(adj?.installments[0].to).toBeNull();
    expect(adj?.installments[0].locked).toBe('invoice_paid');
  });
});
