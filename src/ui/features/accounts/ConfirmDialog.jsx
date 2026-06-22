import React from "react";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Btn } from "../../components/primitives";
import { ModalShell } from "./ModalShell.jsx";

/** Confirmação no design system (substitui window.confirm). */
export function ConfirmDialog({
  titleSans,
  titleSerif,
  message,
  confirmLabel = "Confirmar",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <ModalShell
      titleSans={titleSans}
      titleSerif={titleSerif}
      onClose={onClose}
      footer={
        <>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
          <Btn variant={danger ? "red" : "dark"} onClick={onConfirm}>{busy ? "…" : confirmLabel}</Btn>
        </>
      }
    >
      <div style={{ ...G, fontSize: 13.5, color: T.inkMid, lineHeight: 1.5, marginTop: 4 }}>{message}</div>
    </ModalShell>
  );
}
