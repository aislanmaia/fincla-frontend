// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
