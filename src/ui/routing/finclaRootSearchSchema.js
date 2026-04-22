import { z } from "zod";
import { FC, FC_MODAL } from "./searchContract.js";

/**
 * Converte string vazia / só espaços em `undefined` para não poluir o estado tipado.
 * Limita tamanho para mitigar URLs absurdamente longas.
 */
function optionalTrimmedString(max = 4096) {
  return z.preprocess((val) => {
    if (val == null || val === "") return undefined;
    const s = String(val).trim();
    if (s === "") return undefined;
    return s.length > max ? s.slice(0, max) : s;
  }, z.string().max(max).optional());
}

/** UUID opaco na URL: formato inválido vira `undefined` sem falhar o schema inteiro. */
function optionalUuidParam() {
  return z.preprocess((val) => {
    if (val == null || val === "") return undefined;
    const s = String(val).trim();
    if (!s) return undefined;
    return z.string().uuid().safeParse(s).success ? s : undefined;
  }, z.string().uuid().optional());
}

const fcModalSchema = z.preprocess((val) => {
  const s = val == null || val === "" ? "" : String(val).trim();
  if (s === FC_MODAL.NEW_TRANSACTION || s === FC_MODAL.NEW_RECURRING) return s;
  return undefined;
}, z.enum([FC_MODAL.NEW_TRANSACTION, FC_MODAL.NEW_RECURRING]).optional());

const fcSimItemSchema = z.preprocess((val) => {
  const s = val == null || val === "" ? "" : String(val).trim();
  const allowed = [
    "recurring_expense",
    "installment_expense",
    "recurring_income",
    "oneoff_income",
    "category_adjustment",
  ];
  return allowed.includes(s) ? s : undefined;
}, z.enum([
  "recurring_expense",
  "installment_expense",
  "recurring_income",
  "oneoff_income",
  "category_adjustment",
]).optional());

/** `fc_add` / `fc_sim_open`: na URL é `"1"`; alguns loaders entregam número `1`. */
const fcUrlFlagOneSchema = z.preprocess((val) => {
  if (val == null || val === "" || val === false) return undefined;
  if (val === 1 || val === true) return "1";
  const s = String(val).trim();
  return s === "1" ? "1" : undefined;
}, z.literal("1").optional());

/**
 * Allowlist de query na raiz (`/` e rotas filhas herdam o mesmo search validado).
 * - Auth por e-mail: sem prefixo `fc_` (ver `authEntryUrl.js`).
 * - Estado partilhável da app: prefixo `fc_` (modais, filtros, simulação).
 */
export const finclaRootSearchSchema = z.object({
  invite_token: optionalTrimmedString(),
  invitation_token: optionalTrimmedString(),
  reset_token: optionalTrimmedString(),
  action: optionalTrimmedString(64),
  token: optionalTrimmedString(),

  [FC.MODAL]: fcModalSchema,
  [FC.TX]: optionalUuidParam(),
  [FC.CARD]: optionalUuidParam(),
  [FC.CATEGORY]: optionalTrimmedString(256),
  [FC.ADD]: fcUrlFlagOneSchema,
  [FC.SIM_OPEN]: fcUrlFlagOneSchema,
  [FC.SIM_ITEM]: fcSimItemSchema,
});

/** Para testes e uso fora do router (parse puro). */
export function parseFinclaRootSearch(raw) {
  return finclaRootSearchSchema.parse(raw ?? {});
}
