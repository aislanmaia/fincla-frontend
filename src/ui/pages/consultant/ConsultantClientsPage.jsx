import React from "react";

import { Card, PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { ConsultantClientsToolbar } from "../../features/consultant/ConsultantClientsToolbar";
import { ConsultantClientCard } from "../../features/consultant/ConsultantClientCard";
import { ConsultantClientsTable } from "../../features/consultant/ConsultantClientsTable";
import { selectConsultantClients } from "../../features/consultant/consultantClientsView";

function EmptyState({ title, text }) {
  return (
    <Card style={{ padding: "40px 24px", textAlign: "center" }}>
      <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>{text}</div>
    </Card>
  );
}

/**
 * Carteira de clientes do consultor (A2.2, S2). Consome `useConsultantClients`
 * (lista enriquecida) e aplica busca/filtro por risco/ordenação client-side via
 * `selectConsultantClients`. Alterna entre grid de cards e tabela densa.
 *
 * Estados explícitos (na prioridade): erro total (nada carregado) · carregando ·
 * carteira vazia (base sem clientes) · sem resultado para os filtros · lista.
 * O clique em "Abrir" é stub até a rota de relatório do cliente (S3).
 */
export function ConsultantClientsPage() {
  const { clients, total, isLoading, error, hasLoaded, loadedOk } = useConsultantClients();

  const [query, setQuery] = React.useState("");
  const [riskFilter, setRiskFilter] = React.useState("all");
  const [sortKey, setSortKey] = React.useState("health");
  const [sortDir, setSortDir] = React.useState("asc");
  const [view, setView] = React.useState("card");

  const visible = React.useMemo(
    () => selectConsultantClients(clients, { query, riskFilter, sortKey, sortDir }),
    [clients, query, riskFilter, sortKey, sortDir],
  );

  // Com clientes em tela mostramos a lista mesmo se um refetch falhou (preserva a
  // última lista boa — lição da A1.3). Sem clientes, um erro tem prioridade sobre
  // "vazio": não afirmar que a carteira está vazia se a busca de fato falhou.
  const state = clients.length > 0
    ? "list"
    : error
      ? "error"
      : !hasLoaded || isLoading
        ? "loading"
        : "empty";

  const openClient = React.useCallback(() => {
    // TODO(S3): navegar para /consultant/clients/:id (relatório do cliente).
  }, []);

  return (
    <div style={{ ...G, width: "100%", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <PageTitle sans="Carteira de" serif="clientes" />
        <p style={{ ...G, fontSize: 13, color: T.inkLight, marginTop: 8 }}>
          {loadedOk ? `${total} ${total === 1 ? "cliente" : "clientes"} sob sua gestão.` : "Todos os clientes sob sua gestão."}
        </p>
      </div>

      {state === "list" && (
        <>
          <ConsultantClientsToolbar
            query={query}
            onQueryChange={setQuery}
            riskFilter={riskFilter}
            onRiskFilterChange={setRiskFilter}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            sortDir={sortDir}
            onSortDirChange={setSortDir}
            view={view}
            onViewChange={setView}
          />

          {visible.length === 0 ? (
            <EmptyState
              title="Nenhum cliente encontrado"
              text="Nenhum cliente corresponde à busca ou ao filtro selecionado. Ajuste os critérios."
            />
          ) : view === "table" ? (
            <ConsultantClientsTable clients={visible} onOpenClient={openClient} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
              {visible.map((client) => (
                <ConsultantClientCard key={client.organization_id} client={client} onOpenClient={openClient} />
              ))}
            </div>
          )}
        </>
      )}

      {state === "empty" && (
        <EmptyState
          title="Sua carteira está vazia"
          text="Você ainda não gerencia nenhum cliente. Ao adicionar clientes, eles aparecerão aqui com saúde, patrimônio e tendências."
        />
      )}
      {state === "error" && (
        <EmptyState
          title="Não foi possível carregar"
          text="Houve um erro ao buscar a sua carteira de clientes. Tente atualizar em instantes."
        />
      )}
      {state === "loading" && (
        <EmptyState title="Carregando…" text="Buscando a sua carteira de clientes." />
      )}
    </div>
  );
}
