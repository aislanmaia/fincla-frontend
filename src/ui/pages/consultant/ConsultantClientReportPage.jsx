import React from "react";
import { useNavigate, useParams } from "@tanstack/react-router";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { ConsultantClientReportHeader } from "../../features/consultant/ConsultantClientReportHeader";
import { resolveClientReportState } from "../../features/consultant/consultantClientReport";

function EmptyState({ title, text, action }) {
  return (
    <Card style={{ padding: "40px 24px", textAlign: "center" }}>
      <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>{text}</div>
      {action}
    </Card>
  );
}

/**
 * Relatório do cliente (A3.1, S3) — rota `/consultant/clients/$id` ($id = org do
 * cliente). O "Abrir" da carteira leva aqui. Nesta fatia entregamos o cabeçalho
 * (nome/saúde/patrimônio, via a própria carteira) e o esqueleto das abas; os
 * reads por-org (Visão geral, Transações, Cartões, Categorias) chegam em A3.2+.
 *
 * Estados: cliente na carteira → relatório; ainda carregando → "carregando";
 * erro sem lista → "erro"; carregou e o id não é cliente do consultor →
 * "não encontrado" (protege deep-links inválidos e ids fora da carteira).
 */
export function ConsultantClientReportPage() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const { clients, hasLoaded, isLoading, error } = useConsultantClients();

  const { status, client } = resolveClientReportState({ clients, id, hasLoaded, isLoading, error });

  const goToWallet = React.useCallback(() => {
    navigate({ to: "/consultant/clients" });
  }, [navigate]);

  const backLink = (
    <button
      type="button"
      onClick={goToWallet}
      style={{ ...G, marginTop: 16, background: "none", border: "none", color: T.blue, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
    >
      ← Voltar para a carteira
    </button>
  );

  return (
    <div style={{ ...G, width: "100%", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      {status === "ready" && (
        <>
          <ConsultantClientReportHeader client={client} onBack={goToWallet} />
          <Card style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 6 }}>Relatório em construção</div>
            <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
              Em breve: visão geral, transações, cartões e categorias deste cliente.
            </div>
          </Card>
        </>
      )}

      {status === "loading" && <EmptyState title="Carregando…" text="Buscando os dados do cliente." />}
      {status === "error" && (
        <EmptyState
          title="Não foi possível carregar"
          text="Houve um erro ao buscar a sua carteira de clientes. Tente atualizar em instantes."
          action={backLink}
        />
      )}
      {status === "not_found" && (
        <EmptyState
          title="Cliente não encontrado"
          text="Este cliente não está na sua carteira, ou o endereço está incorreto."
          action={backLink}
        />
      )}
    </div>
  );
}
