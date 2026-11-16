// "Extratos importados" com os campos do rascunho (decisão do Owner de 2026-11-16): a lista vem da
// fixture canônica do backend e cada campo novo chega normalizado, sem virar zero quando falta.
import { describe, expect, it } from 'vitest';

import contract from '../__fixtures__/statement_import.example.json';
import { normalizeStatementImportListItem } from '../statementImports';

const [draft, concluded] = contract.imports.imports.map((raw) =>
  normalizeStatementImportListItem(raw as Parameters<typeof normalizeStatementImportListItem>[0]),
);

describe('normalizeStatementImportListItem', () => {
  it('o rascunho traz o passo, a diferença agora em número, se dá para concluir e as ações da conferência', () => {
    expect(draft.current_step).toBe('new');
    expect(draft.balance_now).toEqual({ date: '2026-10-31', bank: 1834.1, fincla: 1857.16, difference: -23.06, currency: 'BRL' });
    expect(draft.can_conclude).toBe(false);
    expect(draft.blockers).toEqual([{ code: 'missing_description', count: 1 }]);
    expect(draft.balance_check_actions).toEqual({ delete: 1, change_date: 0 });
  });

  it('fora de rascunho, nada disso existe: nulos e vazios, nunca zero', () => {
    expect(concluded.current_step).toBeNull();
    expect(concluded.balance_now).toBeNull();
    expect(concluded.can_conclude).toBe(false);
    expect(concluded.blockers).toEqual([]);
    expect(concluded.balance_check_actions).toBeNull();
  });
});
