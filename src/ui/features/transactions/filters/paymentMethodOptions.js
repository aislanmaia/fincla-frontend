import {
  MET_LABELS,
  METHODS_DESPESA,
  METHODS_RECEITA,
} from "../../novaTransacao/novaTransacaoConstants.js";

const METHOD_OPTIONS_BY_TYPE = {
  receita: METHODS_RECEITA,
  despesa: METHODS_DESPESA,
};

const ALL_METHOD_OPTIONS = [...METHODS_RECEITA, ...METHODS_DESPESA].filter(
  ([value], index, arr) => arr.findIndex(([candidate]) => candidate === value) === index,
);

export function getPaymentMethodOptions(type) {
  if (type === "receita" || type === "despesa") return METHOD_OPTIONS_BY_TYPE[type];
  return ALL_METHOD_OPTIONS;
}

export function getPaymentMethodLabel(method) {
  if (!Array.isArray(method) || method.length === 0) return "Todas";
  if (method.length === 1) return MET_LABELS[method[0]] || method[0];
  return `${method.length} formas`;
}

export function isPaymentMethodAllowedForType(method, type) {
  if (!method) return true;
  const values = Array.isArray(method) ? method : [method];
  return values.every((value) => getPaymentMethodOptions(type).some(([candidate]) => candidate === value));
}
