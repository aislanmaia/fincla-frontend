/** Dados mock de demonstração — trocar por API */
/* ─── DATA ───────────────────────────────────────────────── */
export const TODAY_CAL = 8;   // March 8 (calendar context)
export const TODAY_RIT = 18;  // March 18 (ritmo context)
export const BUDGET    = 4200;
export const dpr       = BUDGET / 31;

export const rhythmData = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  const proj = +(dpr * d).toFixed(0);
  const real = d <= TODAY_RIT
    ? Math.max(50, Math.round(dpr * d * 0.97 + Math.sin(d * 1.7) * 110 + Math.cos(d * 0.9) * 60))
    : null;
  return { day: d, proj, real };
});
export const curReal = rhythmData[TODAY_RIT - 1].real;
export const curProj = rhythmData[TODAY_RIT - 1].proj;
export const dailyRateReal = curReal / TODAY_RIT; // média diária real observada

// Projeção ao ritmo atual: parte do ponto real do dia TODAY_RIT e extrapola
export const estouroDia = dailyRateReal > 0
  ? Math.ceil(BUDGET / dailyRateReal)
  : null;

// Adiciona ritmoAtual a cada ponto do rhythmData
rhythmData.forEach(d => {
  if (d.day >= TODAY_RIT) {
    d.ritmoAtual = Math.round(curReal + dailyRateReal * (d.day - TODAY_RIT));
  } else {
    d.ritmoAtual = null;
  }
});

// ── FEV/26 — mês fechado (28 dias) ──────────────────────────
export const BUDGET_FEV = 4200;
export const dpr_fev    = BUDGET_FEV / 28;
export const fev26Data  = Array.from({ length: 28 }, (_, i) => {
  const d    = i + 1;
  const proj = +(dpr_fev * d).toFixed(0);
  const real = Math.max(80, Math.round(
    dpr_fev * d * 1.04
    + Math.sin(d * 1.4) * 130
    + Math.cos(d * 0.7) * 70
  ));
  return { day: d, proj, real, ritmoAtual: null };
});
export const fev26Real  = fev26Data[27].real;
export const fev26Proj  = fev26Data[27].proj;
export const fev26Daily = Math.round(fev26Real / 28);
export const fev26Over  = fev26Real > BUDGET_FEV;

export const TRANSACTIONS = [
  { id:1,  desc:"Supermercado Extra",   cat:"Alimentação",  val:-320.50, date:"10/03/2026", icon:"🛒", method:"Débito",      rec:false, status:"confirmado", tags:["mercado","compras"] },
  { id:2,  desc:"Salário Março",        cat:"Receita",      val:+6400,   date:"05/03/2026", icon:"💼", method:"TED",          rec:true,  status:"confirmado", tags:["salário"] },
  { id:3,  desc:"Netflix",              cat:"Assinaturas",  val:-55.90,  date:"08/03/2026", icon:"📺", method:"Crédito",      rec:true,  status:"confirmado", tags:["streaming"] },
  { id:4,  desc:"Posto Shell",          cat:"Transporte",   val:-180.00, date:"09/03/2026", icon:"⛽", method:"Crédito",      rec:false, status:"confirmado", tags:["combustível"] },
  { id:5,  desc:"Aluguel",              cat:"Moradia",      val:-1800,   date:"05/03/2026", icon:"🏠", method:"TED",          rec:true,  status:"confirmado", tags:["aluguel"] },
  { id:6,  desc:"iFood",               cat:"Alimentação",  val:-89.90,  date:"10/03/2026", icon:"🍔", method:"Crédito",      rec:false, status:"pendente",   tags:["delivery"] },
  { id:7,  desc:"Spotify",             cat:"Assinaturas",  val:-21.90,  date:"07/03/2026", icon:"🎵", method:"Crédito",      rec:true,  status:"confirmado", tags:["streaming"] },
  { id:8,  desc:"Academia Smart Fit",  cat:"Saúde",        val:-109.90, date:"01/03/2026", icon:"💪", method:"Crédito",      rec:true,  status:"confirmado", tags:["academia"] },
  { id:9,  desc:"Uber — Centro",        cat:"Transporte",   val:-32.50,  date:"11/03/2026", icon:"🚗", method:"Crédito",      rec:false, status:"confirmado", tags:["uber"] },
  { id:10, desc:"Farmácia Drogas Raia", cat:"Saúde",        val:-67.80,  date:"11/03/2026", icon:"💊", method:"Débito",       rec:false, status:"confirmado", tags:["farmácia"] },
  { id:11, desc:"Conta de Luz",         cat:"Moradia",      val:-214.30, date:"12/03/2026", icon:"⚡", method:"Boleto",       rec:true,  status:"confirmado", tags:["energia"] },
  { id:12, desc:"Restaurante Madero",   cat:"Alimentação",  val:-156.00, date:"13/03/2026", icon:"🍽️", method:"Crédito",     rec:false, status:"confirmado", tags:["restaurante"] },
  { id:13, desc:"Freelance — Design",   cat:"Receita",      val:+2800,   date:"14/03/2026", icon:"🎨", method:"Pix",          rec:false, status:"confirmado", tags:["freelance"] },
  { id:14, desc:"Internet Vivo Fibra",  cat:"Moradia",      val:-99.90,  date:"15/03/2026", icon:"📶", method:"Débito",       rec:true,  status:"confirmado", tags:["internet"] },
  { id:15, desc:"Mercado Livre",        cat:"Compras",      val:-248.90, date:"15/03/2026", icon:"📦", method:"Crédito",      rec:false, status:"confirmado", tags:["compras","online"] },
  { id:16, desc:"Cinema CineCity",      cat:"Lazer",        val:-85.00,  date:"16/03/2026", icon:"🎬", method:"Crédito",      rec:false, status:"confirmado", tags:["lazer"] },
  { id:17, desc:"Pix recebido — Ana",   cat:"Receita",      val:+350,    date:"17/03/2026", icon:"📲", method:"Pix",          rec:false, status:"confirmado", tags:["pix recebido"] },
  { id:18, desc:"Padaria Dona Benta",   cat:"Alimentação",  val:-42.50,  date:"18/03/2026", icon:"🥐", method:"Débito",       rec:false, status:"confirmado", tags:["padaria"] },
  { id:19, desc:"Uber Eats",           cat:"Alimentação",  val:-73.80,  date:"19/03/2026", icon:"🛵", method:"Crédito",      rec:false, status:"pendente",   tags:["delivery"] },
  { id:20, desc:"Condomínio",           cat:"Moradia",      val:-520,    date:"05/03/2026", icon:"🏢", method:"Boleto",       rec:true,  status:"confirmado", tags:["condomínio"] },
  { id:21, desc:"MacBook Pro 14pol",       cat:"Compras",      val:-3600,   date:"18/03/2026", icon:"💻", method:"Crédito",      rec:false, status:"confirmado", tags:["eletrônico","trabalho"], parcela:{atual:1, total:12, valParcela:300, cartao:"Nubank •• 1177", vencimento:"10/04/2026", valorTotal:3600, valorPago:300, valorResidual:3300} },
  { id:22, desc:"Curso de React",         cat:"Educação",     val:-899,    date:"12/03/2026", icon:"📚", method:"Crédito",      rec:false, status:"confirmado", tags:["curso"], parcela:{atual:3, total:6, valParcela:149.83, cartao:"Inter •• 5521", vencimento:"15/04/2026", valorTotal:899, valorPago:449.49, valorResidual:449.51} },
  { id:23, desc:"iPhone 15 — Americanas", cat:"Compras",      val:-8000,   date:"02/03/2026", icon:"📱", method:"Crédito",      rec:false, status:"confirmado", tags:["eletrônico"], parcela:{atual:5, total:24, valParcela:333.33, cartao:"Nubank •• 1177", vencimento:"10/04/2026", valorTotal:8000, valorPago:1666.65, valorResidual:6333.35} },
];

export const RECORRENCIAS = [
  // despesas
  { id:1,  desc:"Nubank — fatura cartão", cat:"Cartão crédito", val:1240,  dia:10, ativa:true,  proximo:"10/03/2026", proximoFull:"10/04/2026", tipo:"despesa", metodo:"Cartão crédito", freq:"Mensal · dia 10", inicio:"Jan 2024", enc:"Sem data fim", urgente:true, diasUrg:2, pago:false, icone:"💳", valorTipo:"fixo", progPct: 68 },
  { id:2,  desc:"Aluguel",                cat:"Moradia",        val:1500,  dia:5,  ativa:true,  proximo:"05/04/2026", proximoFull:"05/04/2026", tipo:"despesa", metodo:"Pix",           freq:"Mensal · dia 5",  inicio:"Mar 2022", enc:"Sem data fim", pago:true,                icone:"🏠", valorTipo:"fixo", progPct: 100 },
  { id:3,  desc:"Conta de luz (CEMAR)",   cat:"Utilidades",     val:180,   dia:13, ativa:true,  proximo:"13/03/2026", proximoFull:"13/03/2026", tipo:"despesa", metodo:"Boleto",        freq:"Mensal · dia 13", inicio:"Jan 2020", enc:"Sem data fim", urgente:true, diasUrg:5, pago:false, icone:"⚡", valorTipo:"estimado", progPct: 45 },
  { id:4,  desc:"Plano celular Vivo",     cat:"Comunicação",    val:120,   dia:15, ativa:true,  proximo:"15/03/2026", proximoFull:"15/03/2026", tipo:"despesa", metodo:"Débito auto.",  freq:"Mensal · dia 15", inicio:"Jun 2021", enc:"Sem data fim",                           icone:"📱", valorTipo:"fixo", progPct: 35 },
  { id:5,  desc:"Academia SmartFit",      cat:"Saúde",          val:99.90, dia:1,  ativa:false, proximo:"01/04/2026", proximoFull:"01/04/2026", tipo:"despesa", metodo:"Débito auto.",  freq:"Mensal · dia 1",  inicio:"Ago 2023", enc:"Sem data fim",                           icone:"💪", valorTipo:"fixo", progPct: 0  },
  // receitas
  { id:7,  desc:"Salário — Empresa XYZ", cat:"Renda", val:6200, dia:5,  ativa:true, proximo:"05/04/2026", proximoFull:"05/04/2026", tipo:"receita", metodo:"Transferência", freq:"Mensal · dia 5",  inicio:"Mar 2020", enc:"Sem data fim", pago:true,                icone:"💼", valorTipo:"estimado", progPct: 100 },
  { id:8,  desc:"Salário — Consultoria", cat:"Renda", val:2200, dia:10, ativa:true, proximo:"10/03/2026", proximoFull:"10/03/2026", tipo:"receita", metodo:"Pix",           freq:"Mensal · dia 10", inicio:"Jan 2025", enc:"Sem data fim", urgente:true, diasUrg:2, pago:false, icone:"💼", valorTipo:"estimado", progPct: 80  },
];

export const FLUXO_MENSAL = [
  { mes:"jan", desp:3200, rec:8900, sim:0    },
  { mes:"fev", desp:4100, rec:8900, sim:0    },
  { mes:"mar", desp:4830, rec:8900, sim:229.9},
  { mes:"abr", desp:3800, rec:8900, sim:229.9},
];

export const PROXIMOS = [
  { dia:10, mes:"MAR", desc:"Salário Consultoria",    tipo:"receita",  metodo:"Pix",           val:+2200   },
  { dia:10, mes:"MAR", desc:"Fatura Nubank",           tipo:"despesa",  metodo:"Cartão crédito",val:-1240   },
  { dia:13, mes:"MAR", desc:"Conta de luz",             tipo:"despesa",  metodo:"Boleto",        val:-180    },
  { dia:1,  mes:"ABR", desc:"Adobe Creative Cloud",    tipo:"simulada", metodo:"Assinaturas",   val:-54.99  },
  { dia:1,  mes:"ABR", desc:"Renda extra freelance",   tipo:"simulada", metodo:"Renda",         val:+800    },
];

export const SIM_ITEMS = [
  { id:1, nome:"MacBook Air M3",  cat:"Tecnologia", banco:"Nubank", parcelas:12, valParcela:349.17, total:4190, badge:"12× meses" },
  { id:2, nome:'Monitor LG 27"', cat:"Tecnologia", banco:"Itaú",   parcelas:3,  valParcela:183.33, total:550,  badge:"3× meses"  },
  { id:3, nome:"Teclado + Mouse", cat:"Tecnologia", banco:"Pix",    parcelas:1,  valParcela:150,    total:150,  badge:null        },
];

export const simRhythm = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  const proj = +(dpr * d).toFixed(0);
  const real = d <= 12
    ? Math.max(50, Math.round(dpr * d * 0.97 + Math.sin(d * 1.7) * 90))
    : null;
  const withSim = d > 12
    ? Math.round((dpr * 12 * 0.97) + (dpr * 1.18) * (d - 12))
    : null;
  return { day: d, proj, real, budget: BUDGET, withSim };
});

export const cashflow = [
  { m:"Out", r:5200, d:3800 }, { m:"Nov", r:5800, d:4200 },
  { m:"Dez", r:6200, d:5100 }, { m:"Jan", r:5400, d:3600 },
  { m:"Fev", r:5900, d:4800 }, { m:"Mar", r:6100, d:4100 },
];
