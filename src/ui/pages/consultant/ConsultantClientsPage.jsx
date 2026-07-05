import React from "react";
import { useNavigate } from "@tanstack/react-router";

import { Btn, Card, PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { regenerateClientActivationLink } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";
import { useAddClient } from "../../features/consultant/ConsultantAddClientContext.jsx";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { ConsultantClientsToolbar } from "../../features/consultant/ConsultantClientsToolbar";
import { ConsultantClientCard } from "../../features/consultant/ConsultantClientCard";
import { ConsultantClientsTable } from "../../features/consultant/ConsultantClientsTable";
import { Icon } from "../../features/consultant/consultantUi";
import { fmtMoney } from "../../features/consultant/consultantFormat";
import { buildClientsCsv, countClientsByBand, selectConsultantClients, totalPatrimonio } from "../../features/consultant/consultantClientsView";

function EmptyState({ title, text }) {
  return (
    <Card style={{ padding: "40px 24px", textAlign: "center" }}>
      <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>{text}</div>
    </Card>
  );
}

/** Kicker (sobre-título) do header. */
function Kicker({ children }) {
  return (
    <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
      {children}
    </div>
  );
}

/** Botão de ação real (habilitado) — ex.: "Exportar" da carteira. */
function ActionButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.surface, color: T.inkMid, fontSize: 12, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, whiteSpace: "nowrap" }}
    >
      <Icon name={icon} size={14} color={T.inkMid} /> {label}
    </button>
  );
}

/**
 * Carteira de clientes do consultor (RF.6 — reimplementada fiel à referência
 * `cons-clientes.jsx`): header (kicker "{n} clientes · {patrimônio} sob
 * acompanhamento" + título + ações Exportar/Adicionar[stubs]); toolbar com busca +
 * **pills de risco coloridas com contadores** + ordenação + toggle cartões/tabela;
 * cards/linhas fiéis (Avatar + HealthRing + RiskBadge + mini-stats + ações inline
 * Avaliar/Mensagem = stubs "em breve"). Card/linha clicável → relatório
 * (`/consultant/clients/$id`, A3.1). Busca/filtro/ordenação client-side via
 * `selectConsultantClients`. Estados: erro total · carregando · carteira vazia ·
 * sem-resultado · lista.
 */
export function ConsultantClientsPage() {
  const navigate = useNavigate();
  const { openAddClient, clientsVersion, quota } = useAddClient();
  const { clients, total, isLoading, error, hasLoaded, loadedOk, refresh } = useConsultantClients();

  // Ao criar um cliente pelo wizard, atualiza a lista para exibi-lo.
  React.useEffect(() => {
    if (clientsVersion > 0) refresh();
  }, [clientsVersion, refresh]);

  const [query, setQuery] = React.useState("");
  const [riskFilter, setRiskFilter] = React.useState("all");
  const [sortKey, setSortKey] = React.useState("health");
  const [sortDir, setSortDir] = React.useState("asc");
  const [view, setView] = React.useState("card");

  const visible = React.useMemo(
    () => selectConsultantClients(clients, { query, riskFilter, sortKey, sortDir }),
    [clients, query, riskFilter, sortKey, sortDir],
  );
  const counts = React.useMemo(() => countClientsByBand(clients), [clients]);
  const patrimonio = React.useMemo(() => totalPatrimonio(clients), [clients]);

  const state = clients.length > 0
    ? "list"
    : error
      ? "error"
      : !hasLoaded || isLoading
        ? "loading"
        : "empty";

  const openClient = React.useCallback((organizationId) => {
    if (!organizationId) return;
    navigate({ to: "/consultant/clients/$id", params: { id: organizationId } });
  }, [navigate]);

  const [linkModal, setLinkModal] = React.useState(null); // { link } | { error }
  const onRegenerate = React.useCallback(async (organizationId) => {
    if (!organizationId) return;
    setLinkModal({ loading: true });
    try {
      const res = await regenerateClientActivationLink(organizationId);
      setLinkModal({ link: res.set_password_link });
    } catch (err) {
      setLinkModal({ error: handleApiError(err) });
    }
  }, []);

  // Cota do plano (autoritativa, do endpoint /consultant/quota).
  const limit = quota?.limit ?? null;
  const remaining = quota?.remaining ?? null;
  const isFull = quota != null && quota.remaining <= 0;

  // Exportar a carteira (a lista visível, respeitando busca/filtro) como CSV.
  const onExportCsv = React.useCallback(() => {
    const csv = buildClientsCsv(visible);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fincla-consultor-carteira-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [visible]);

  return (
    <div style={{ ...G, width: "100%", boxSizing: "border-box", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <Kicker>
            {loadedOk
              ? `${limit != null ? `${total} de ${limit}` : total} ${total === 1 && limit == null ? "cliente" : "clientes"} · ${fmtMoney(patrimonio)} sob acompanhamento`
              : "Sua carteira de clientes"}
          </Kicker>
          <PageTitle sans="Carteira" serif="de clientes" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          {loadedOk && remaining != null && (
            <span style={{ ...G, fontSize: 12, fontWeight: 600, color: isFull ? T.red : T.inkMid }}>
              {isFull ? "Limite do plano atingido" : `${remaining} ${remaining === 1 ? "vaga restante" : "vagas restantes"}`}
            </span>
          )}
          <ActionButton icon="download" label="Exportar" onClick={onExportCsv} disabled={state !== "list"} />
          <Btn variant="dark" onClick={openAddClient}><Icon name="plus" size={14} color="#fff" /> Adicionar cliente</Btn>
        </div>
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
            counts={counts}
          />

          {visible.length === 0 ? (
            <EmptyState
              title="Nenhum cliente encontrado"
              text="Nenhum cliente corresponde à busca ou ao filtro selecionado. Ajuste os critérios."
            />
          ) : view === "table" ? (
            <ConsultantClientsTable clients={visible} onOpenClient={openClient} onRegenerate={onRegenerate} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
              {visible.map((client) => (
                <ConsultantClientCard key={client.organization_id} client={client} onOpenClient={openClient} onRegenerate={onRegenerate} />
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

      {linkModal && <ActivationLinkModal state={linkModal} onClose={() => setLinkModal(null)} />}
    </div>
  );
}

/** Modal simples com o novo link de definição de senha (regenerado). */
function ActivationLinkModal({ state, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    try {
      navigator.clipboard?.writeText(state.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível */ }
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div role="presentation" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,15,13,0.5)" }} />
      <Card style={{ position: "relative", width: 520, maxWidth: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...G, fontSize: 16, fontWeight: 800, color: T.ink }}>Novo link de definição de senha</div>
        {state.loading && <div style={{ ...G, fontSize: 13, color: T.inkLight }}>Gerando link…</div>}
        {state.error && <div style={{ ...G, fontSize: 13, color: T.red }}>{state.error}</div>}
        {state.link && (
          <>
            <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.5 }}>
              O link anterior foi invalidado. Envie este novo link para o cliente definir a senha. Expira e é de uso único.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px" }}>
              <input readOnly value={state.link} aria-label="Link de definição de senha" style={{ ...G, flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 12, color: T.inkMid }} />
              <Btn variant="outGray" small onClick={copy}>{copied ? "Copiado" : "Copiar"}</Btn>
            </div>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <Btn variant="dark" onClick={onClose}>Fechar</Btn>
        </div>
      </Card>
    </div>
  );
}
