// A fronteira da Conciliar fatura (fincla-api#555) sobre a fixture de contrato, cópia byte a byte
// de `fincla-api/docs/contracts/card_invoice_import.example.json` (presa aos modelos de lá).
import { describe, expect, it } from 'vitest';

import contract from '../__fixtures__/card_invoice_import.example.json';
import {
  invoiceDraftInProgressOf,
  isCardInvoiceResponse,
  normalizeCardInvoiceImport,
  normalizeCardInvoiceImportListItem,
} from '../cardInvoiceImports';
import { normalizeStatementUndoPreview } from '../statementImports';

const KEYS = [
  'id', 'position', 'date', 'bank_description', 'amount', 'section', 'installment', 'next_installments', 'foreign_amount',
  'card_last4', 'classification', 'answer', 'confirmed', 'answerable', 'suggested_transaction_id', 'paired_transaction_id',
  'fincla_transaction', 'value_change', 'value_locked',
];

describe('normalizeCardInvoiceImport', () => {
  it('a fixture traz todos os campos que a tela lê em cada lançamento', () => {
    for (const entry of contract.draft.entries) expect(Object.keys(entry).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(contract.entry).sort()).toEqual([...KEYS].sort());
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
    expect(draft.invoice.total).toEqual({ amount: 890.87, currency: 'BRL' });
    expect(draft.difference_now).toEqual({ bank: 2402.92, fincla: 890.84, difference: 1512.08, currency: 'BRL' });
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
    expect(done.final_difference).toEqual({ amount: 1512.08, currency: 'BRL' });
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
    expect(again.summary.already_reconciled).toBe(4);
    const conferred = again.entries.filter((e) => e.classification === 'reconciled');
    expect(conferred).toHaveLength(4);
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
    expect(draft.summary.already_reconciled).toBe(4);
    expect(undone.undone_at).toBe(contract.list.imports[1].undone_at);
    expect(undone.final_difference).toEqual({ amount: 1512.08, currency: 'BRL' });
    expect(concluded.latest_concluded).toBe(true);
    expect(concluded.invoice.total).toEqual({ amount: 890.84, currency: 'BRL' });
    expect(concluded.difference_now).toEqual({ bank: 2402.92, fincla: 890.84, difference: 1512.08, currency: 'BRL' });
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
  });

  it('a desfeita: status undone, undone_at e o que o desfazer apagou', () => {
    const undone = normalizeCardInvoiceImport(raw(contract.undone));
    expect(undone.status).toBe('undone');
    expect(undone.undone_at).toBe(contract.undone.undone_at);
    expect((contract.undone as { deleted_transactions: number }).deleted_transactions).toBe(0);
  });
});
