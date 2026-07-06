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
  if (!method || method === "todos") return "Todas";
  return MET_LABELS[method] || method;
}

export function isPaymentMethodAllowedForType(method, type) {
  if (!method || method === "todos") return true;
  return getPaymentMethodOptions(type).some(([value]) => value === method);
}
