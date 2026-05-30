import { CardFormSheet } from "./CardFormSheet.jsx";
import { ExportInvoiceModal, ReallocateInstallmentModal } from "./CartoesModals.jsx";

/**
 * Stack global de modais/sheets da `CartoesPage` (realocar parcela, exportar
 * fatura, e add/editar cartão). Encapsula o wiring de props que era duplicado
 * idêntico nos shells mobile e desktop.
 */
export function CardsPageModals({
  isMobile,
  card,
  invoice,
  formatBRL,
  // ReallocateInstallmentModal
  installmentModal,
  installmentTarget,
  setInstallmentTarget,
  installmentSaved,
  onCloseInstallmentModal,
  onConfirmInstallment,
  // ExportInvoiceModal
  exportModalOpen,
  displayItems,
  exportCategories,
  setExportCategories,
  exportInstallments,
  setExportInstallments,
  exportRecurring,
  setExportRecurring,
  exportOneTime,
  setExportOneTime,
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
      <ReallocateInstallmentModal
        installmentModal={installmentModal}
        installmentTarget={installmentTarget}
        setInstallmentTarget={setInstallmentTarget}
        installmentSaved={installmentSaved}
        card={card}
        formatBRL={formatBRL}
        isMobile={isMobile}
        onClose={onCloseInstallmentModal}
        onConfirm={onConfirmInstallment}
      />
      <ExportInvoiceModal
        open={exportModalOpen}
        card={card}
        invoice={invoice}
        displayItems={displayItems}
        exportCategories={exportCategories}
        setExportCategories={setExportCategories}
        exportInstallments={exportInstallments}
        setExportInstallments={setExportInstallments}
        exportRecurring={exportRecurring}
        setExportRecurring={setExportRecurring}
        exportOneTime={exportOneTime}
        setExportOneTime={setExportOneTime}
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
