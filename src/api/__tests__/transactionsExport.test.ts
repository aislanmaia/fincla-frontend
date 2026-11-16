import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { repeatArrayParams } from '../paramsSerializer';
import { exportTransactions, exportTransactionsCsv, fileNameFromDisposition } from '../transactions';

vi.mock('../client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** O exportador é a única porta: pede BYTES (CSV hoje, XLSX/PDF binários depois) e lê o nome do servidor. */
describe('exportTransactions', () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset());

  it('pede os bytes, com os filtros repetíveis e os textos da tela, e devolve o nome do Content-Disposition', async () => {
    const blob = new Blob(['﻿a,b'], { type: 'text/csv' });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="transacoes-2026-11-15.csv"' },
    });

    const file = await exportTransactions({
      organization_id: 'org-1', format: 'csv', title: 'Transações', filters_text: ['Busca: x'], file_prefix: 'transacoes',
    });

    expect(file.fileName).toBe('transacoes-2026-11-15.csv');
    // O BOM chega intacto: sem ele a planilha estraga os acentos.
    expect(new Uint8Array(await file.blob.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
    const [url, config] = vi.mocked(apiClient.get).mock.calls[0];
    expect(url).toBe('/transactions/export');
    expect(config).toMatchObject({
      responseType: 'arraybuffer',
      params: { organization_id: 'org-1', format: 'csv', title: 'Transações', filters_text: ['Busca: x'], file_prefix: 'transacoes' },
    });
    // Repetível (`filters_text=a&filters_text=b`, `account_id=…&account_id=…`), não `filters_text[]=`.
    expect(config?.paramsSerializer).toBe(repeatArrayParams);
  });

  it.each([
    [422, { detail: { code: 'export_too_large', total: 25000, limit: 20000 } }],
    [409, { detail: { code: 'export_changed', message: 'mudou' } }],
  ])('um erro %i com corpo em bytes vira o JSON que o app lê', async (status, body) => {
    const error = { response: { status, data: new TextEncoder().encode(JSON.stringify(body)).buffer } };
    vi.mocked(apiClient.get).mockRejectedValueOnce(error);

    await expect(exportTransactions({ organization_id: 'org-1', format: 'csv' })).rejects.toBe(error);
    expect(error.response.data).toEqual(body);
  });

  it('um corpo de erro ilegível não vira um detalhe inventado', async () => {
    const error = { response: { status: 500, data: new TextEncoder().encode('<html>').buffer } };
    vi.mocked(apiClient.get).mockRejectedValueOnce(error);

    await expect(exportTransactions({ organization_id: 'org-1', format: 'csv' })).rejects.toBe(error);
    expect(error.response.data).toBeUndefined();
  });

  it('exportTransactionsCsv (lançamentos do cartão) passa pela mesma porta, em CSV', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: new TextEncoder().encode('x').buffer, headers: {} });

    expect(await (await exportTransactionsCsv({ organization_id: 'org-1', credit_card_id: [5] })).text()).toBe('x');
    expect(vi.mocked(apiClient.get).mock.calls[0][1]?.params).toEqual({ organization_id: 'org-1', credit_card_id: [5], format: 'csv' });
  });
});

describe('fileNameFromDisposition', () => {
  it.each([
    ['attachment; filename="transacoes-2026-11-15.csv"', 'transacoes-2026-11-15.csv'],
    ["attachment; filename*=UTF-8''relat%C3%B3rio.pdf", 'relatório.pdf'],
    ['attachment; filename=plain.csv', 'plain.csv'],
    [undefined, null],
    ['inline', null],
  ])('%s → %s', (header, expected) => {
    expect(fileNameFromDisposition(header)).toBe(expected);
  });
});
