/** Identity selects the journey; only the backend grants paid access. */
export const checkoutPersona = (user) => user?.is_consultant === true || user?.subscription?.plan?.startsWith("consultant_") ? "consultant" : "personal";
