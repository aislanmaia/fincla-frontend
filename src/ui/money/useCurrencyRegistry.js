/**
 * Carrega o registro de moedas uma vez por sessão e avisa quem espera por ele.
 *
 * **Uma requisição só, mesmo com dez componentes pedindo.** O registro é um
 * catálogo pequeno e imutável durante a sessão; sem a promessa compartilhada,
 * cada modal aberto dispararia o seu próprio GET. `emVoo` é o que garante isso.
 *
 * **Falha não derruba tela.** Se o GET falhar, `currencyInfo` continua respondendo
 * pelo `Intl`, e o app segue desenhando dinheiro — o que se perde é a LISTA de
 * moedas que o produto oferece, e aí o seletor mostra só a moeda que já está em
 * uso. Melhor uma escolha reduzida do que uma tela quebrada.
 */

import { useEffect, useState } from "react";

import { listCurrencies } from "../../api/currencies";
import {
  currencyInfo,
  currencyRegistryLoaded,
  offeredCurrencies,
  setCurrencyRegistry,
} from "./currencyRegistry.js";

let emVoo = null;

/** Garante o registro carregado. Devolve a MESMA promessa para chamadas simultâneas. */
export function ensureCurrencyRegistry() {
  if (currencyRegistryLoaded()) return Promise.resolve(true);
  if (!emVoo) {
    emVoo = listCurrencies()
      .then((moedas) => {
        setCurrencyRegistry(moedas);
        return currencyRegistryLoaded();
      })
      .catch(() => false)
      .finally(() => {
        emVoo = null;
      });
  }
  return emVoo;
}

/**
 * As moedas que a tela pode oferecer, carregando o registro se preciso.
 *
 * `fallbackCode` é a moeda que já está em uso naquela tela. Ela entra na lista
 * quando o registro não respondeu — sem isso o seletor ficaria VAZIO e a pessoa
 * perderia de vista a moeda da própria conta.
 */
export function useCurrencyOptions(fallbackCode = "BRL") {
  const [carregado, setCarregado] = useState(currencyRegistryLoaded());

  useEffect(() => {
    if (currencyRegistryLoaded()) return undefined;
    let vivo = true;
    ensureCurrencyRegistry().then((ok) => {
      if (vivo && ok) setCarregado(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const doRegistro = offeredCurrencies();
  if (doRegistro.length > 0) {
    return { carregado, moedas: doRegistro.map(paraOpcao) };
  }
  return { carregado, moedas: [paraOpcao(currencyInfo(fallbackCode))] };
}

function paraOpcao(m) {
  return { code: m.code, label: m.name, symbol: m.symbol };
}
