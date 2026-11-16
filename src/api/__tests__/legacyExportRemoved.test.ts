/**
 * fincla-api#528: o caminho antigo de exportação sumiu.
 *
 * Toda exportação passa por `GET /v1/transactions/export` (painel único). O endpoint
 * `/analytics/export-csv`, o cliente dele e o atalho de Relatórios que o chamava não
 * podem voltar por engano, nem por import esquecido.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as analyticsApi from '../analytics';
import * as reportsAdapter from '../../ui/data/reportsAdapter.js';

const SRC = path.resolve(__dirname, '../..');
const LEGACY = /analytics\/export-csv|exportTransactionsCsv\b|downloadTransactionsCsv\b|downloadReportsCsvForUi\b/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    if (!/\.(js|jsx|ts|tsx)$/.test(entry.name) || /\.test\./.test(entry.name)) return [];
    return [full];
  });
}

describe('exportação antiga removida', () => {
  it('nenhum código de produção referencia o endpoint antigo ou o cliente dele', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files
      .filter((file) => LEGACY.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('o cliente de analytics não exporta mais as funções do CSV antigo', () => {
    expect(analyticsApi).not.toHaveProperty('exportTransactionsCsv');
    expect(analyticsApi).not.toHaveProperty('downloadTransactionsCsv');
    expect(reportsAdapter).not.toHaveProperty('downloadReportsCsvForUi');
  });
});
