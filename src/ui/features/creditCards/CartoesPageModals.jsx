import { CardFormSheet } from "./CardFormSheet.jsx";
import { ExportModal, ParcelaModal } from "./CartoesModals.jsx";

/**
 * Stack global de modais/sheets da `CartoesPage` (realocar parcela, exportar
 * fatura, e add/editar cartão). Encapsula o wiring de props que era duplicado
 * idêntico nos shells mobile e desktop.
 */
export function CartoesPageModals({
  isMobile,
  card,
  fatura,
  fmtBRL,
  // ParcelaModal
  parcelaModal,
  parcelaTarget,
  setParcelaTarget,
  parcelaOk,
  onCloseParcelaModal,
  onConfirmParcela,
  // ExportModal
  exportModal,
  displayItens,
  expCats,
  setExpCats,
  expParcelas,
  setExpParcelas,
  expRec,
  setExpRec,
  expNormal,
  setExpNormal,
  onCloseExportModal,
  onExportCSV,
  // CardFormSheet
  cardSheetOpen,
  editCardSheet,
  draftIssuer,
  setDraftIssuer,
  draftName,
  setDraftName,
  draftLast4,
  setDraftLast4,
  draftBrand,
  setDraftBrand,
  draftLimit,
  setDraftLimit,
  draftDueDay,
  setDraftDueDay,
  draftClosingDay,
  setDraftClosingDay,
  draftSuccess,
  savingCard,
  cardSheetError,
  onSaveCard,
  onUpdateCard,
  onCancelCardForm,
}) {
  return (
    <>
      <ParcelaModal
        parcelaModal={parcelaModal}
        parcelaTarget={parcelaTarget}
        setParcelaTarget={setParcelaTarget}
        parcelaOk={parcelaOk}
        card={card}
        fmtBRL={fmtBRL}
        isMobile={isMobile}
        onClose={onCloseParcelaModal}
        onConfirm={onConfirmParcela}
      />
      <ExportModal
        open={exportModal}
        card={card}
        fatura={fatura}
        displayItens={displayItens}
        expCats={expCats}
        setExpCats={setExpCats}
        expParcelas={expParcelas}
        setExpParcelas={setExpParcelas}
        expRec={expRec}
        setExpRec={setExpRec}
        expNormal={expNormal}
        setExpNormal={setExpNormal}
        isMobile={isMobile}
        onClose={onCloseExportModal}
        onExport={onExportCSV}
      />
      <CardFormSheet
        open={cardSheetOpen}
        isMobile={isMobile}
        isEdit={editCardSheet}
        draftIssuer={draftIssuer}
        setDraftIssuer={setDraftIssuer}
        draftName={draftName}
        setDraftName={setDraftName}
        draftLast4={draftLast4}
        setDraftLast4={setDraftLast4}
        draftBrand={draftBrand}
        setDraftBrand={setDraftBrand}
        draftLimit={draftLimit}
        setDraftLimit={setDraftLimit}
        draftDueDay={draftDueDay}
        setDraftDueDay={setDraftDueDay}
        draftClosingDay={draftClosingDay}
        setDraftClosingDay={setDraftClosingDay}
        draftSuccess={draftSuccess}
        saving={savingCard}
        error={cardSheetError}
        onSave={onSaveCard}
        onUpdate={onUpdateCard}
        onCancel={onCancelCardForm}
      />
    </>
  );
}
