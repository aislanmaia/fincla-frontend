/* ─── SIMULAÇÃO — estado inicial (cenários mock) ─────────── */

export const SIM_CENARIOS_INIT = [
  { id: 1, nome: "Setup home office", budgetOverride: null,
    items: [
      { id:1, tipo:"despesa_parcelada",  nome:"MacBook Air M3",       cat:"Tecnologia",  banco:"Nubank",            parcelas:12, meses:null, valParcela:349.17, total:4190,  badge:"12× meses", isReceita:false, isAjuste:false },
      { id:2, tipo:"despesa_parcelada",  nome:'Monitor LG 27"',        cat:"Tecnologia",  banco:"Itaú Personnalité", parcelas:3,  meses:null, valParcela:183.33, total:550,   badge:"3× meses",  isReceita:false, isAjuste:false },
      { id:3, tipo:"despesa_recorrente", nome:"Adobe Creative Cloud",  cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:89.90,  total:89.90, badge:"12 meses",  isReceita:false, isAjuste:false },
      { id:4, tipo:"despesa_recorrente", nome:"Notion Pro",            cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:6,    valParcela:45,     total:45,    badge:"6 meses",   isReceita:false, isAjuste:false },
    ]
  },
  { id: 2, nome: "Upgrade assinaturas", budgetOverride: 4800,
    items: [
      { id:1, tipo:"despesa_recorrente", nome:"Adobe Creative Cloud",  cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:89.90,  total:89.90, badge:"12 meses",  isReceita:false, isAjuste:false },
      { id:2, tipo:"receita_recorrente", nome:"Freela mensal",         cat:"Renda",       banco:"-",                 parcelas:1,  meses:6,    valParcela:800,    total:800,   badge:"6 meses",   isReceita:true,  isAjuste:false },
      { id:3, tipo:"ajuste_categoria",   nome:"Corte em Alimentação",  cat:"Alimentação", banco:"-",                 parcelas:1,  meses:3,    valParcela:200,    total:200,   badge:"3 meses",   isReceita:false, isAjuste:true  },
    ]
  },
  { id: 3, nome: "Reforma do quarto", budgetOverride: null,
    items: [
      { id:1, tipo:"despesa_parcelada",  nome:"Materiais",             cat:"Moradia",     banco:"Itaú Personnalité", parcelas:6,  meses:null, valParcela:533.33, total:3200,  badge:"6× meses",  isReceita:false, isAjuste:false },
      { id:2, tipo:"despesa_recorrente", nome:"Netflix Premium",       cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:55.90,  total:55.90, badge:"12 meses",  isReceita:false, isAjuste:false },
    ]
  },
];
