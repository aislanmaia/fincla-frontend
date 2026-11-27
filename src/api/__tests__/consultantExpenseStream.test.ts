// @vitest-environment jsdom
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleApiError } from '../client';
import { streamConsultantPortfolioExpenseAnalysis } from '../consultant';

afterEach(() => vi.unstubAllGlobals());

describe('consultant expense stream', () => {
  it('delivers the report before the AI result across split UTF-8 frames', async () => {
    const encoder = new TextEncoder();
    let releaseInsight: (() => void) | undefined;
    const insightGate = new Promise<void>((resolve) => { releaseInsight = resolve; });
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('event: report.ready\ndata: {"report":{"title":"Distribui'));
        controller.enqueue(encoder.encode('ção"}}\n\nevent: insight.started\ndata: {}\n\n'));
        await insightGate;
        controller.enqueue(encoder.encode('event: insight.ready\ndata: {"insights":[]}\n\nevent: completed\ndata: {}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body });
    vi.stubGlobal('fetch', fetchMock);
    const seen: string[] = [];
    const run = streamConsultantPortfolioExpenseAnalysis(
      { date_start: '2026-01-01', date_end: '2026-01-31' },
      (event) => seen.push(event.type),
    );
    await vi.waitFor(() => expect(seen).toEqual(['report.ready', 'insight.started']));
    releaseInsight?.();
    await run;
    expect(seen).toEqual(['report.ready', 'insight.started', 'insight.ready', 'completed']);
    expect(fetchMock.mock.calls[0][0]).toContain('date_start=2026-01-01');
  });

  it('rejects a disconnected stream without a completion event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('event: report.ready\ndata: {}\n\n')); controller.close(); } }),
    }));
    await expect(streamConsultantPortfolioExpenseAnalysis(
      { date_start: '2026-01-01', date_end: '2026-01-31' }, vi.fn(),
    )).rejects.toThrow('before completion');
  });

  it('cancels the connection when the event handler throws, instead of leaving it open', async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('event: report.ready\ndata: {}\n\n')); },
      cancel: cancelled,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body }));
    await expect(streamConsultantPortfolioExpenseAnalysis(
      { date_start: '2026-01-01', date_end: '2026-01-31' },
      () => { throw new Error('handler failed'); },
    )).rejects.toThrow('handler failed');
    expect(cancelled).toHaveBeenCalled();
  });

  const period = { date_start: '2026-01-01', date_end: '2026-01-31' };

  it.each([
    [403, { detail: 'Assinatura inativa ou pagamento pendente' }, 'Assinatura inativa ou pagamento pendente'],
    [429, {}, 'Muitas tentativas. Aguarde um momento e tente novamente.'],
    [500, {}, 'Erro interno do servidor. Tente novamente mais tarde.'],
  ])('fails a %i like any other API call, so the shared translator can explain it', async (status, body, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, body: null, json: () => Promise.resolve(body) }));
    const failure = await streamConsultantPortfolioExpenseAnalysis(period, vi.fn()).catch((error: unknown) => error);
    expect(axios.isAxiosError(failure)).toBe(true);
    expect(handleApiError(failure)).toBe(message);
  });

  it('still explains an error whose body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 502, body: null, json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    }));
    const failure = await streamConsultantPortfolioExpenseAnalysis(period, vi.fn()).catch((error: unknown) => error);
    expect(handleApiError(failure)).toBe('Serviço temporariamente indisponível. Tente novamente em instantes.');
  });

  it('reports an unreachable server as a connection problem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const failure = await streamConsultantPortfolioExpenseAnalysis(period, vi.fn()).catch((error: unknown) => error);
    expect(handleApiError(failure)).toBe('Não foi possível conectar ao servidor. Verifique sua conexão.');
  });

  const brokenBody = (reason: unknown) => new ReadableStream<Uint8Array>({
    pull(controller) { controller.error(reason); },
  });

  it('reports a connection dropped in the middle of the stream as a connection problem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: brokenBody(new TypeError('network error')) }));
    const failure = await streamConsultantPortfolioExpenseAnalysis(period, vi.fn()).catch((error: unknown) => error);
    expect(handleApiError(failure)).toBe('Não foi possível conectar ao servidor. Verifique sua conexão.');
  });

  it('lets a cancellation during the stream through untouched', async () => {
    const aborted = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: brokenBody(aborted) }));
    await expect(streamConsultantPortfolioExpenseAnalysis(period, vi.fn())).rejects.toBe(aborted);
  });

  it('explains a missing plan feature without showing its internal code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403, body: null,
      json: () => Promise.resolve({ detail: "Recurso 'consultant_ai' não disponível no seu plano" }),
    }));
    const failure = await streamConsultantPortfolioExpenseAnalysis(period, vi.fn()).catch((error: unknown) => error);
    expect(handleApiError(failure)).toBe('Este recurso não está disponível no seu plano.');
  });

  it('lets a cancellation through untouched', async () => {
    const aborted = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));
    await expect(streamConsultantPortfolioExpenseAnalysis(period, vi.fn())).rejects.toBe(aborted);
  });
});
