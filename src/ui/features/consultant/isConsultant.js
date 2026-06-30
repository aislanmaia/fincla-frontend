/**
 * True se o usuário autenticado tem perfil de consultor (plano de consultoria).
 * O backend deriva `role: "consultant"` do plano (consultant_basic/pro/premium/beta).
 */
export function isConsultant(user) {
  return user?.role === "consultant";
}
