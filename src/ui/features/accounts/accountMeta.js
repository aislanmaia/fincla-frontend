import { T } from "../../tokens";

/** Tipos oferecidos no seletor de conta (o backend também aceita 'crypto'). */
export const ACCOUNT_TYPES = [
  { value: "checking", label: "Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimento" },
  { value: "wallet", label: "Carteira" },
];

const META = {
  checking: { label: "corrente", emoji: "🏦", tint: T.purpleLight },
  savings: { label: "poupança", emoji: "🐷", tint: T.greenLight },
  investment: { label: "investimento", emoji: "📈", tint: T.amberLight },
  wallet: { label: "carteira", emoji: "👛", tint: T.grayLight },
  crypto: { label: "cripto", emoji: "🪙", tint: T.purpleLight },
};

export function accountMeta(type) {
  return META[type] || META.wallet;
}

/** Swatches de cor (hex) e ícones para o formulário de conta. */
export const ACCOUNT_COLORS = [T.purple, T.blue, T.green, T.amber, T.red];
export const ACCOUNT_ICONS = ["🏦", "🐷", "📈", "💳", "💰", "👛"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(value) {
  return brl.format(Number(value || 0));
}

/** Converte "R$ 1.234,56" / "1234,56" / "1234.56" em número. */
export function parseBRL(input) {
  if (typeof input === "number") return input;
  const cleaned = String(input || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
