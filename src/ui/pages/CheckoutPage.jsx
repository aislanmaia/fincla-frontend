import { useEffect, useState } from "react";
import { quoteCheckout } from "../../api/checkout";
import { T } from "../tokens.js";
import { G, NUM } from "../typography.js";
import { Card, Btn } from "../components/primitives.jsx";

const money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function CheckoutPage({ search = window.location.search }) {
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState({ status: "error", message: "A consulta demorou mais que o esperado. Tente novamente." });
    }, 10000);
    setState({ status: "loading" });
    quoteCheckout(search, controller.signal).then((receivedQuote) => {
      if (!controller.signal.aborted) setState({ status: "ready", quote: receivedQuote });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ status: "error", message: error.message });
    }).finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [search, attempt]);

  const quote = state.status === "ready" ? state.quote : null;
  return (
    <main className="fincla-scroll" style={{ ...G, height: "100%", overflowY: "auto", background: T.bg, color: T.ink, padding: "32px 20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <img src="/logo.png" alt="Fincla" width={40} height={40} />
        <h1 style={{ fontSize: 30, letterSpacing: "-0.03em", marginTop: 32 }}>Sua escolha no Fincla</h1>
        <p style={{ color: T.inkMid, lineHeight: 1.6 }}>Confira sua oferta e o período de contratação.</p>
        {state.status === "loading" && <p role="status">Consultando sua oferta…</p>}
        {state.status === "error" && <Card style={{ padding: 24 }}>
          <p role="alert">{state.message}</p>
          <Btn onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Btn>
        </Card>}
        {quote && <Card style={{ padding: 28, marginTop: 24 }}>
          <h2>{quote.selection.persona === "personal" ? "Fincla Pessoal" : "Fincla Consultor"}</h2>
          {quote.capacity != null && <p>{quote.capacity} vagas contratadas · {quote.selection.mode === "package" ? `Pacote de ${quote.selection.package_size}` : "Preço progressivo"}</p>}
          <p style={{ ...NUM, fontSize: 38, fontWeight: 700, marginBottom: 8 }}>{money(quote.total_cents)}</p>
          <p>{quote.selection.billing_cycle === "yearly" ? "Pagamento anual antecipado" : "Pagamento mensal antecipado"}</p>
          <p style={{ color: T.inkMid, lineHeight: 1.6 }}>A contratação online estará disponível em breve. Nenhuma cobrança foi realizada.</p>
        </Card>}
      </div>
    </main>
  );
}
