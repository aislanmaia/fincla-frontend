/**
 * Quão atual é o que uma tela de saldos mostra (#264). `null` = não afirmar nada
 * (modo demonstração/sem organização: não há leitura para datar). Uma releitura que
 * falhou NÃO apresenta os valores anteriores como atuais.
 */
export function accountsFreshnessLabel(data, enabled) {
  if (!enabled) return null;
  if (data.isLoading) return data.hasLoaded ? "atualizando…" : null;
  if (data.refreshFailed) return "não foi possível atualizar";
  return data.hasLoaded ? "atualizado agora" : null;
}
