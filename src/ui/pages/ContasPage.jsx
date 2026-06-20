import React, { useState } from "react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { PageTitle, Card, Btn, Badge, PageEnter } from "../components/primitives";
import { useAccountsData } from "../features/accounts/useAccountsData.js";
import { accountMeta, formatBRL } from "../features/accounts/accountMeta.js";
import { NovaContaModal } from "../features/accounts/NovaContaModal.jsx";
import { TransferenciaModal } from "../features/accounts/TransferenciaModal.jsx";

const menuItemStyle = {
  ...G,
  display: "block",
  width: "100%",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 500,
  padding: "9px 13px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: T.inkMid,
};

export function ContasPage({ organizationId, dataMode = "live", isMobile = false }) {
  const enabled = !!organizationId && dataMode === "live";
  const data = useAccountsData({ organizationId, enabled });

  const [showNova, setShowNova] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const accounts = data.accounts || [];
  const accountModalOpen = showNova || !!editAccount;

  function closeAccountModal() {
    setShowNova(false);
    setEditAccount(null);
  }

  async function handleAccountSubmit(payload) {
    try {
      if (editAccount) await data.updateAccount(editAccount.id, payload);
      else await data.createAccount(payload);
      closeAccountModal();
    } catch {
      /* erro fica em data.error, exibido no modal */
    }
  }

  async function handleTransfer(payload) {
    try {
      await data.transfer(payload);
      setShowTransfer(false);
    } catch {
      /* erro em data.error */
    }
  }

  async function handleDeactivate(account) {
    setOpenMenuId(null);
    if (!window.confirm(`Desativar a conta "${account.name}"? Ela deixa de aparecer no saldo.`)) return;
    try {
      await data.deactivateAccount(account.id);
    } catch {
      /* erro em data.error */
    }
  }

  return (
    <PageEnter>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <PageTitle sans="Minhas" serif="Contas" />
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <Btn variant="outGray" onClick={() => setShowTransfer(true)} small={isMobile}>⇄ Transferir</Btn>
            <Btn variant="dark" onClick={() => setShowNova(true)} small={isMobile}>+ Nova conta</Btn>
          </div>
        </div>

        {data.error ? (
          <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginTop: 14 }}>
            {data.error}
          </div>
        ) : null}

        {/* Saldo disponível */}
        <Card style={{ marginTop: 16, padding: 18 }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: T.inkLight }}>
            Saldo disponível
          </div>
          <div style={{ ...G, ...NUM, fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: T.ink, marginTop: 6 }}>
            {formatBRL(data.total)}
          </div>
          <div style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 4 }}>
            {accounts.length} {accounts.length === 1 ? "conta" : "contas"} · atualizado agora
          </div>
        </Card>

        {/* Lista de contas */}
        {data.isLoading && !data.hasLoaded ? (
          <div style={{ ...G, fontSize: 13, color: T.inkLight, padding: "24px 4px" }}>Carregando contas…</div>
        ) : accounts.length === 0 && data.hasLoaded ? (
          <Card style={{ marginTop: 14, padding: "28px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 26 }}>🏦</div>
            <div style={{ ...G, fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 8 }}>Nenhuma conta ainda</div>
            <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 4, marginBottom: 14 }}>
              Cadastre sua primeira conta para acompanhar o saldo.
            </div>
            <Btn variant="dark" onClick={() => setShowNova(true)}>+ Criar primeira conta</Btn>
          </Card>
        ) : (
          <Card style={{ marginTop: 14, overflow: "hidden" }}>
            {accounts.map((a, idx) => {
              const meta = accountMeta(a.type);
              return (
                <div key={a.id}>
                  {idx > 0 ? <div style={{ height: 1, background: T.border }} /> : null}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                    <div style={{ width: 38, height: 38, flex: "0 0 38px", borderRadius: 11, display: "grid", placeItems: "center", fontSize: 19, background: meta.tint }}>
                      {a.icon_key || meta.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...G, fontSize: 14, fontWeight: 600, color: T.ink, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        {a.name}
                        <Badge>{meta.label}</Badge>
                        {!a.include_in_total ? <Badge color={T.amber} bg={T.amberLight}>fora do total</Badge> : null}
                      </div>
                      {a.institution ? (
                        <div style={{ ...G, fontSize: 11, color: T.inkGhost, marginTop: 2 }}>{a.institution}</div>
                      ) : null}
                    </div>
                    <div style={{ ...G, ...NUM, fontWeight: 700, fontSize: 14, color: a.include_in_total ? T.ink : T.inkLight }}>
                      {formatBRL(a.balance)}
                    </div>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setOpenMenuId((id) => (id === a.id ? null : a.id))}
                        aria-label="Ações da conta"
                        style={{ border: "none", background: "none", cursor: "pointer", color: T.inkGhost, fontSize: 18, lineHeight: 1, padding: 4 }}
                      >
                        ⋮
                      </button>
                      {openMenuId === a.id ? (
                        <>
                          <div onClick={() => setOpenMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 15 }} />
                          <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.md, zIndex: 20, minWidth: 150, overflow: "hidden" }}>
                            <button style={menuItemStyle} onClick={() => { setOpenMenuId(null); setEditAccount(a); }}>Editar</button>
                            <div style={{ height: 1, background: T.border }} />
                            <button style={{ ...menuItemStyle, color: T.red }} onClick={() => handleDeactivate(a)}>Desativar</button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        <div style={{ ...G, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: T.inkGhost, marginTop: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 9999, background: T.inkGhost, flex: "0 0 7px" }} />
          Transferências entre contas próprias não contam como receita ou despesa.
        </div>
      </div>

      {accountModalOpen ? (
        <NovaContaModal
          account={editAccount}
          onClose={closeAccountModal}
          onSubmit={handleAccountSubmit}
          isSaving={data.isSaving}
          error={data.error}
        />
      ) : null}

      {showTransfer ? (
        <TransferenciaModal
          accounts={accounts}
          onClose={() => setShowTransfer(false)}
          onSubmit={handleTransfer}
          isSaving={data.isSaving}
          error={data.error}
        />
      ) : null}
    </PageEnter>
  );
}
