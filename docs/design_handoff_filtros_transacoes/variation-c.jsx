/* eslint-disable no-undef */
// Variação C — Faceted Pills (tweakable)
// Lê window.TweaksContext para reagir a:
//   savedViews: "cards" | "pills" | "menu"
//   facetBar:   "cards" | "pills" | "buttons"
//   facetPanel: "inline" | "popover" | "drawer"

function VariationC() {
  const tweaks = React.useContext(window.TweaksContext);
  const savedViewsMode = tweaks.savedViews || "cards";
  const facetBarMode = tweaks.facetBar || "cards";
  const facetPanelMode = tweaks.facetPanel || "popover";

  // Debug — força estado inicial pra screenshots (window.__SS tem prioridade; hash como fallback).
  // Valores: "newview" | "sort" | "sort-multi" | "facet-<key>"
  const _hash = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.slice(1)) : null;
  const _ss = (typeof window !== "undefined" && window.__SS) || (_hash && _hash.get("ss")) || null;

  const [expanded, setExpanded] = React.useState(
    _ss && _ss.indexOf("facet-") === 0 ? _ss.slice(6) : null
  );
  const [savedActive, setSavedActive] = React.useState("v1");
  const [savedMenuOpen, setSavedMenuOpen] = React.useState(false);
  const [newViewOpen, setNewViewOpen] = React.useState(_ss === "newview" ? "cards" : null);
  const [sortOpen, setSortOpen] = React.useState(_ss === "sort" || _ss === "sort-multi");
  const [sort, setSort] = React.useState(
    _ss === "sort-multi"
      ? [{ field: "date", dir: "desc" }, { field: "val", dir: "asc" }, { field: "tipo", dir: "desc" }]
      : [{ field: "date", dir: "desc" }]
  );
  const [search, setSearch] = React.useState("");
  const [cats, setCats] = React.useState(["alim", "trans"]);
  const [tags, setTags] = React.useState(["trabalho"]);
  const [cardSel, setCardSel] = React.useState(["nub-1177"]);
  const [period, setPeriod] = React.useState("mes");
  const [type, setType] = React.useState("despesa");
  const [rec, setRec] = React.useState("any");
  const [savedViews, setSavedViews] = React.useState([
    { id: "v1", label: "Despesas do mês", icon: "calendar", color: T.ink, hint: "42 transações" },
    { id: "v2", label: "Cartão Nubank", icon: "card", color: "#7C3AED", hint: "23 lançamentos" },
    { id: "v3", label: "Acima de R$ 200", icon: "trending", color: T.amber, hint: "17 transações" },
    { id: "v4", label: "Recorrentes", icon: "repeat", color: T.blue, hint: "8 ativas" },
    { id: "v5", label: "Reembolsáveis", icon: "bookmark", color: T.green, hint: "5 pendentes" },
  ]);

  const parseTxDate = (d) => {
    const [day, month] = d.split("/").map(Number);
    return month * 100 + day;
  };
  const compareByField = (x, y, field) => {
    switch (field) {
      case "date": return parseTxDate(x.date) - parseTxDate(y.date);
      case "val":  return x.val - y.val;
      case "desc": return (x.desc || "").localeCompare(y.desc || "", "pt-BR");
      case "cat":  return (x.cat || "").localeCompare(y.cat || "");
      case "tipo": return Math.sign(x.val) - Math.sign(y.val);
      default: return 0;
    }
  };
  const sortItems = (arr) => {
    if (!sort.length) return arr;
    return [...arr].sort((x, y) => {
      for (const rule of sort) {
        const cmp = compareByField(x, y, rule.field);
        if (cmp !== 0) return rule.dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  };

  const handleCreateView = (draft) => {
    const id = "v" + Date.now();
    const next = { id, label: draft.name, icon: draft.icon, color: draft.color, hint: "Recém criada" };
    setSavedViews((prev) => [...prev, next]);
    setSavedActive(id);
    setNewViewOpen(null);
    setSavedMenuOpen(false);
  };

  const handleDeleteView = (id) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
    if (savedActive === id) setSavedActive(null);
  };

  const filtered = window.TX.filter((t) => {
    if (type === "despesa" && t.val > 0) return false;
    if (type === "receita" && t.val < 0) return false;
    return true;
  });
  const items = sortItems(filtered);

  const facets = [
    {
      key: "periodo",
      label: "Período",
      value: { mes: "Este mês", hoje: "Hoje", semana: "Esta semana", "3m": "Últimos 3m", ano: "Este ano" }[period] || "Este mês",
      icon: "calendar",
      active: period !== null,
    },
    {
      key: "tipo",
      label: "Tipo",
      value: { todos: "Todos", receita: "Receita", despesa: "Despesa" }[type],
      icon: type === "receita" ? "trending" : type === "despesa" ? "trending-down" : "filter",
      color: type === "receita" ? T.green : type === "despesa" ? T.red : null,
      active: type !== "todos",
    },
    {
      key: "categoria",
      label: "Categoria",
      value:
        cats.length === 0 ? "Todas" :
        cats.length === 1 ? window.CAT_BY_ID[cats[0]].label : `${cats.length} categorias`,
      icon: "circle",
      active: cats.length > 0,
      multi: cats.length,
    },
    {
      key: "tag",
      label: "Tags",
      value: tags.length === 0 ? "—" : tags.length === 1 ? `#${tags[0]}` : `${tags.length} tags`,
      icon: "tag",
      active: tags.length > 0,
      multi: tags.length,
    },
    {
      key: "cartao",
      label: "Cartão",
      value:
        cardSel.length === 0 ? "Todos" :
        cardSel.length === 1 ? window.CARDS.find((c) => c.id === cardSel[0]).label :
        `${cardSel.length} cartões`,
      icon: "card",
      active: cardSel.length > 0,
      multi: cardSel.length,
    },
    {
      key: "valor",
      label: "Valor",
      value: "Qualquer",
      icon: "trending",
      active: false,
    },
    {
      key: "recorrencia",
      label: "Recorrência",
      value: { any: "Todas", yes: "Apenas rec.", no: "Únicas" }[rec],
      icon: "repeat",
      active: rec !== "any",
    },
  ];

  const activeFacets = facets.filter((f) => f.active).map((f) => ({
    label: f.label, value: f.value, icon: f.icon, color: f.color || T.ink,
  }));

  const panelProps = {
    period, setPeriod, type, setType,
    cats, setCats, tags, setTags,
    cardSel, setCardSel, rec, setRec,
    onClose: () => setExpanded(null),
    compact: facetPanelMode !== "inline",
  };

  // Container precisa ser relative pra ancorar o drawer.
  return (
    <div
      style={{
        position: "relative",
        ...G,
        background: T.bg,
        minHeight: 920,
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        overflow: "hidden",
      }}
      onClick={() => {
        if (savedMenuOpen) setSavedMenuOpen(false);
        if (newViewOpen) setNewViewOpen(null);
        if (sortOpen) setSortOpen(false);
      }}
    >
      <PageHeader />

      {/* SAVED VIEWS — 3 modos */}
      {savedViewsMode === "cards" && (
        <SavedViewsCards
          items={savedViews}
          active={savedActive}
          setActive={setSavedActive}
          newOpen={newViewOpen === "cards"}
          setNewOpen={(v) => setNewViewOpen(v ? "cards" : null)}
          activeFacets={activeFacets}
          onCreate={handleCreateView}
          onDelete={handleDeleteView}
        />
      )}
      {savedViewsMode === "pills" && (
        <SavedViewsPills
          items={savedViews}
          active={savedActive}
          setActive={setSavedActive}
          newOpen={newViewOpen === "pills"}
          setNewOpen={(v) => setNewViewOpen(v ? "pills" : null)}
          activeFacets={activeFacets}
          onCreate={handleCreateView}
          onDelete={handleDeleteView}
        />
      )}

      {/* SEARCH BAR — inclui menu de Saved Views se em modo "menu" */}
      <SearchBar
        search={search}
        setSearch={setSearch}
        savedViewsMode={savedViewsMode}
        savedViews={savedViews}
        savedActive={savedActive}
        setSavedActive={setSavedActive}
        savedMenuOpen={savedMenuOpen}
        setSavedMenuOpen={setSavedMenuOpen}
        sort={sort}
        setSort={setSort}
        sortOpen={sortOpen}
        setSortOpen={setSortOpen}
        newOpen={newViewOpen === "menu"}
        setNewOpen={(v) => setNewViewOpen(v ? "menu" : null)}
        activeFacets={activeFacets}
        onCreate={handleCreateView}
        onDelete={handleDeleteView}
      />

      {/* FACET BAR — 3 modos. Popover é renderizado como filho de cada pill (anchored). */}
      <FacetBar
        mode={facetBarMode}
        panelMode={facetPanelMode}
        facets={facets}
        expanded={expanded}
        setExpanded={setExpanded}
        panelProps={panelProps}
      />

      {/* PAINEL INLINE — empurra o conteúdo (apenas se modo == inline) */}
      {expanded && facetPanelMode === "inline" && (
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: "18px 22px",
            boxShadow: T.md,
            animation: "fadeInDown 0.18s ease",
          }}
        >
          <FacetPanelContent facetKey={expanded} {...panelProps} />
        </div>
      )}

      <KpiStrip items={items} />

      <TxList items={items.slice(0, 6)} />

      {/* DRAWER — overlay direito quando facetPanel == drawer */}
      {expanded && facetPanelMode === "drawer" && (
        <>
          <div
            onClick={() => setExpanded(null)}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(15, 15, 13, 0.18)",
              animation: "fadeIn 0.18s ease",
              zIndex: 60,
            }}
          />
          <div
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0,
              width: 400,
              background: T.surface,
              borderLeft: `1px solid ${T.border}`,
              boxShadow: "-12px 0 36px rgba(0,0,0,0.12)",
              padding: "24px 22px",
              overflowY: "auto",
              zIndex: 61,
              animation: "drawerIn 0.24s cubic-bezier(0.32,0.72,0,1) both",
            }}
          >
            <FacetPanelContent facetKey={expanded} {...panelProps} />
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes drawerIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

// ──────────────────── SAVED VIEWS — MODE 1: Cards
function SavedViewsCards({ items, active, setActive, newOpen, setNewOpen, activeFacets, onCreate, onDelete }) {
  return (
    <div>
      <div
        style={{
          ...G, fontSize: 10, fontWeight: 700, color: T.inkMid,
          textTransform: "uppercase", letterSpacing: "0.08em",
          marginBottom: 8, display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <Icon name="bookmark" size={11} />
        Visualizações salvas
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "visible", paddingBottom: 4 }}>
        {items.map((v) => {
          const isActive = active === v.id;
          return (
            <div
              key={v.id}
              className="saved-view-card"
              role="button"
              tabIndex={0}
              onClick={() => setActive(isActive ? null : v.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(isActive ? null : v.id); } }}
              style={{
                ...G,
                position: "relative",
                display: "flex", alignItems: "center", gap: 9,
                padding: "10px 14px 10px 12px",
                borderRadius: 11,
                border: `1px solid ${isActive ? T.ink : T.border}`,
                background: isActive ? T.ink : T.surface,
                cursor: "pointer", textAlign: "left", flexShrink: 0,
                transition: "all 0.15s",
                boxShadow: isActive ? T.md : T.sm,
              }}
            >
              <div
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: isActive ? "rgba(255,255,255,0.12)" : `${v.color}15`,
                  color: isActive ? "#fff" : v.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icon name={v.icon} size={13} color={isActive ? "#fff" : v.color} />
              </div>
              <div>
                <div style={{ ...G, fontSize: 12.5, fontWeight: 700, color: isActive ? "#fff" : T.ink, lineHeight: 1.2 }}>
                  {v.label}
                </div>
                <div style={{ ...G, fontSize: 10.5, color: isActive ? "rgba(255,255,255,0.65)" : T.inkLight, marginTop: 2 }}>
                  {v.hint}
                </div>
              </div>
              <DeleteViewControl view={v} onDelete={onDelete} variant="corner" cardActive={isActive} />
            </div>
          );
        })}
        <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setNewOpen(!newOpen)}
            style={{
              ...G,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px 14px", borderRadius: 11,
              border: `1px dashed ${newOpen ? T.ink : T.border}`,
              background: newOpen ? T.surface : "transparent",
              color: newOpen ? T.ink : T.inkLight,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              height: "100%",
            }}
          >
            <Icon name="plus" size={12} />
            Nova
          </button>
          {newOpen && (
            <PopoverShell anchorRight>
              <NewViewForm
                activeFacets={activeFacets}
                onCancel={() => setNewOpen(false)}
                onSave={onCreate}
              />
            </PopoverShell>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────── SAVED VIEWS — MODE 2: Pills compactas
function SavedViewsPills({ items, active, setActive, newOpen, setNewOpen, activeFacets, onCreate, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <div
        style={{
          ...G, fontSize: 10, fontWeight: 700, color: T.inkMid,
          textTransform: "uppercase", letterSpacing: "0.08em",
          marginRight: 6, display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <Icon name="bookmark" size={11} />
        Salvas
      </div>
      {items.map((v) => {
        const isActive = active === v.id;
        return (
          <div
            key={v.id}
            className="saved-view-pill"
            role="button"
            tabIndex={0}
            onClick={() => setActive(isActive ? null : v.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(isActive ? null : v.id); } }}
            style={{
              ...G,
              position: "relative",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 8px 5px 9px", borderRadius: 99,
              border: `1px solid ${isActive ? T.ink : T.border}`,
              background: isActive ? T.ink : T.surface,
              color: isActive ? "#fff" : T.inkMid,
              cursor: "pointer", fontSize: 11.5, fontWeight: 600,
            }}
          >
            <Icon name={v.icon} size={10} color={isActive ? "#fff" : v.color} />
            {v.label}
            <DeleteViewControl view={v} onDelete={onDelete} variant="inline" cardActive={isActive} />
          </div>
        );
      })}
      <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setNewOpen(!newOpen)}
          style={{
            ...G,
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 99,
            border: `1px dashed ${newOpen ? T.ink : T.border}`,
            background: "transparent", cursor: "pointer",
            color: newOpen ? T.ink : T.inkLight, fontSize: 11.5, fontWeight: 600,
          }}
        >
          <Icon name="plus" size={10} />
          Nova
        </button>
        {newOpen && (
          <PopoverShell>
            <NewViewForm
              activeFacets={activeFacets}
              onCancel={() => setNewOpen(false)}
              onSave={onCreate}
            />
          </PopoverShell>
        )}
      </div>
    </div>
  );
}

// ──────────────────── SEARCH BAR (+ menu de saved views opcional)
function SearchBar({ search, setSearch, savedViewsMode, savedViews, savedActive, setSavedActive, savedMenuOpen, setSavedMenuOpen, sort, setSort, sortOpen, setSortOpen, newOpen, setNewOpen, activeFacets, onCreate, onDelete }) {
  const activeView = savedViews.find((v) => v.id === savedActive);
  const [sortHover, setSortHover] = React.useState(false);
  const ruleLabel = (rule) => {
    const dir = rule.dir === "asc" ? "↑" : "↓";
    const name = ({ date: "Data", val: "Valor", tipo: "Tipo", desc: "Descrição", cat: "Categoria" })[rule.field] || rule.field;
    return `${name} ${dir}`;
  };
  const sortBtnLabel = sort.length === 0
    ? "Sem ordenação"
    : sort.length === 1
    ? ruleLabel(sort[0])
    : sort.length === 2
    ? `${ruleLabel(sort[0])} · ${ruleLabel(sort[1])}`
    : `${ruleLabel(sort[0])} · +${sort.length - 1}`;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: "11px 14px", boxShadow: T.sm,
      }}
    >
      {/* Botão de saved views menu */}
      {savedViewsMode === "menu" && (
        <div
          style={{ position: "relative" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setSavedMenuOpen(!savedMenuOpen)}
            style={{
              ...G,
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 11px 5px 9px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.bg,
              color: T.ink,
              fontSize: 12, fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Icon name="bookmark" size={11} color={activeView?.color || T.inkMid} />
            <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeView ? activeView.label : "Visualizações"}
            </span>
            <Icon name="chevron-down" size={11} color={T.inkLight} />
          </button>
          {savedMenuOpen && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0,
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 10, boxShadow: T.lg,
                minWidth: 240, padding: 6,
                zIndex: 80,
                animation: "fadeInDown 0.14s ease",
              }}
            >
              {savedViews.map((v) => {
                const a = savedActive === v.id;
                return (
                  <div
                    key={v.id}
                    className="saved-view-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSavedActive(a ? null : v.id); setSavedMenuOpen(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSavedActive(a ? null : v.id); setSavedMenuOpen(false); } }}
                    style={{
                      ...G,
                      position: "relative",
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "8px 10px",
                      borderRadius: 7,
                      background: a ? T.bg : "transparent",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: `${v.color}15`, color: v.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={v.icon} size={11} color={v.color} />
                    </div>
                    <span style={{ flex: 1, fontSize: 12.5, color: T.ink, fontWeight: a ? 700 : 500 }}>
                      {v.label}
                    </span>
                    <span className="saved-view-row-hint" style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{v.hint}</span>
                    <DeleteViewControl view={v} onDelete={onDelete} variant="row" />
                  </div>
                );
              })}
              <div style={{ height: 1, background: T.border, margin: "5px 0" }} />
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setNewOpen(!newOpen); }}
                  style={{
                    ...G,
                    display: "flex", alignItems: "center", gap: 7,
                    width: "100%", padding: "8px 10px",
                    borderRadius: 7, border: "none",
                    background: newOpen ? T.bg : "transparent",
                    cursor: "pointer", textAlign: "left",
                    fontSize: 12, color: T.ink, fontWeight: 600,
                  }}
                >
                  <Icon name="plus" size={11} />
                  Salvar visualização atual
                </button>
                {newOpen && (
                  <PopoverShell>
                    <NewViewForm
                      activeFacets={activeFacets}
                      onCancel={() => setNewOpen(false)}
                      onSave={onCreate}
                    />
                  </PopoverShell>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ width: 1, height: 18, background: T.border, flexShrink: 0, display: savedViewsMode === "menu" ? "block" : "none" }} />
      <Icon name="search" size={15} color={T.inkLight} />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por descrição, valor, tag…"
        style={{
          ...G, flex: 1, border: "none", outline: "none",
          background: "transparent", fontSize: 14, color: T.ink,
        }}
      />
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <span
          style={{
            ...G,
            fontSize: 10, fontWeight: 700, color: T.inkLight,
            textTransform: "uppercase", letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}
        >
          Ordenar por
        </span>
        <button
          onClick={() => setSortOpen(!sortOpen)}
          onMouseEnter={() => setSortHover(true)}
          onMouseLeave={() => setSortHover(false)}
          style={{
            ...G,
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 7,
            border: `1px solid ${sortOpen ? T.ink : T.border}`,
            background: sortOpen ? T.bg : T.surface,
            fontSize: 11.5, fontWeight: 600, color: T.inkMid, cursor: "pointer",
          }}
        >
          <Icon name="arrow-up-down" size={11} />
          {sortBtnLabel}
          {sort.length > 1 && (
            <span
              style={{
                ...G,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 16, height: 16, padding: "0 4px",
                borderRadius: 99,
                background: T.ink, color: "#fff",
                fontSize: 9.5, fontWeight: 700,
              }}
            >
              {sort.length}
            </span>
          )}
        </button>
        {sortOpen && (
          <SortMenu sort={sort} setSort={setSort} onClose={() => setSortOpen(false)} />
        )}
        {sortHover && !sortOpen && sort.length > 0 && (
          <SortTooltip rules={sort} />
        )}
      </div>
    </div>
  );
}

// ──────────────────── FACET BAR — 3 modos
function FacetBar({ mode, panelMode, facets, expanded, setExpanded, panelProps }) {
  const containerStyle =
    mode === "cards"
      ? { gap: 8, padding: 6, alignItems: "stretch" }
      : mode === "pills"
      ? { gap: 6, padding: 8, alignItems: "center", flexWrap: "wrap" }
      : { gap: 4, padding: 6, alignItems: "center", flexWrap: "wrap" };

  return (
    <div
      style={{
        display: "flex",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow: T.sm,
        position: "relative",
        ...containerStyle,
      }}
    >
      {facets.map((f, idx) => (
        <FacetTrigger
          key={f.key}
          mode={mode}
          panelMode={panelMode}
          facet={f}
          expanded={expanded === f.key}
          onClick={() => setExpanded(expanded === f.key ? null : f.key)}
          panelProps={panelProps}
          anchorRight={idx >= facets.length - 2}
        />
      ))}
      {mode === "cards" && <div style={{ flex: 1 }} />}
      <button
        style={{
          ...G,
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: mode === "cards" ? "0 12px" : "5px 10px",
          borderRadius: 9, border: "none",
          background: "transparent",
          fontSize: 11.5, fontWeight: 700,
          color: T.red, cursor: "pointer",
          marginLeft: mode === "cards" ? 0 : "auto",
        }}
      >
        Limpar tudo
      </button>
    </div>
  );
}

// ──────────────────── FACET TRIGGER — switches across 3 visual modes
function FacetTrigger({ mode, panelMode, facet, expanded, onClick, panelProps, anchorRight }) {
  const { label, value, icon, color, active, multi } = facet;

  // ────── visual: cards (2-line)
  if (mode === "cards") {
    return (
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            ...G,
            width: "100%",
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
            padding: "8px 12px", borderRadius: 9,
            border: "none",
            background: expanded ? T.bg : "transparent",
            cursor: "pointer", textAlign: "left",
            position: "relative", transition: "background 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name={icon} size={10} color={active ? (color || T.ink) : T.inkLight} />
            <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {label}
            </span>
            {multi > 1 && <CountChip n={multi} />}
          </div>
          <div
            style={{
              ...G,
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? (color || T.ink) : T.inkLight,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
            }}
          >
            {value}
          </div>
        </button>
        {expanded && panelMode === "popover" && (
          <PopoverShell anchorRight={anchorRight}>
            <FacetPanelContent facetKey={facet.key} {...panelProps} />
          </PopoverShell>
        )}
      </div>
    );
  }

  // ────── visual: pills compactas
  if (mode === "pills") {
    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            ...G,
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px 5px 9px",
            borderRadius: 99,
            border: `1px solid ${active ? (color || T.ink) : T.border}`,
            background: expanded ? T.bg : active ? `${color || T.ink}10` : T.surface,
            color: active ? (color || T.ink) : T.inkMid,
            fontSize: 11.5, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Icon name={icon} size={10} color={active ? (color || T.ink) : T.inkLight} />
          <span style={{ color: T.inkMid, fontWeight: 500 }}>{label}:</span>
          <span style={{ fontWeight: 700, color: active ? (color || T.ink) : T.ink }}>{value}</span>
          {multi > 1 && <CountChip n={multi} dark={!active} />}
        </button>
        {expanded && panelMode === "popover" && (
          <PopoverShell anchorRight={anchorRight}>
            <FacetPanelContent facetKey={facet.key} {...panelProps} />
          </PopoverShell>
        )}
      </div>
    );
  }

  // ────── visual: botões minimalistas (só valor)
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        title={label}
        style={{
          ...G,
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 6,
          border: `1px solid ${active ? T.ink : "transparent"}`,
          background: expanded ? T.bg : "transparent",
          color: active ? T.ink : T.inkMid,
          fontSize: 12, fontWeight: active ? 700 : 500,
          cursor: "pointer",
        }}
      >
        <Icon name={icon} size={10} color={active ? (color || T.ink) : T.inkLight} />
        {value}
        {multi > 1 && <CountChip n={multi} dark />}
      </button>
      {expanded && panelMode === "popover" && (
        <PopoverShell anchorRight={anchorRight}>
          <FacetPanelContent facetKey={facet.key} {...panelProps} />
        </PopoverShell>
      )}
    </div>
  );
}

function CountChip({ n, dark = false }) {
  return (
    <span
      style={{
        ...MONO,
        background: dark ? T.ink : "rgba(255,255,255,0.85)",
        color: dark ? "#fff" : T.ink,
        borderRadius: 99, fontSize: 9, fontWeight: 700,
        padding: "0 5px", lineHeight: "13px",
      }}
    >
      {n}
    </span>
  );
}

function PopoverShell({ anchorRight, children }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        ...(anchorRight ? { right: 0 } : { left: 0 }),
        zIndex: 70,
        minWidth: 420,
        maxWidth: 480,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: T.lg,
        padding: "16px 18px",
        animation: "fadeInDown 0.16s ease",
      }}
    >
      {children}
    </div>
  );
}

// ──────────────────── Mux entre os panels de facet
function FacetPanelContent({ facetKey, period, setPeriod, type, setType, cats, setCats, tags, setTags, cardSel, setCardSel, rec, setRec, onClose, compact }) {
  switch (facetKey) {
    case "periodo":
      return <PeriodPanel period={period} setPeriod={setPeriod} onClose={onClose} compact={compact} />;
    case "tipo":
      return <TypePanel type={type} setType={setType} onClose={onClose} compact={compact} />;
    case "categoria":
      return <CategoryPanel cats={cats} setCats={setCats} onClose={onClose} compact={compact} />;
    case "tag":
      return <TagPanel tags={tags} setTags={setTags} onClose={onClose} />;
    case "cartao":
      return <CardPanel cardSel={cardSel} setCardSel={setCardSel} onClose={onClose} compact={compact} />;
    case "valor":
      return <ValuePanel onClose={onClose} />;
    case "recorrencia":
      return <RecPanel rec={rec} setRec={setRec} onClose={onClose} compact={compact} />;
    default:
      return null;
  }
}

// ──────────────────── NEW VIEW FORM (popover content)
function NewViewForm({ activeFacets, onCancel, onSave }) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(T.blue);
  const [icon, setIcon] = React.useState("bookmark");

  const COLORS = [T.ink, T.blue, T.green, T.amber, T.red, T.purple];
  const ICONS = ["bookmark", "calendar", "card", "trending", "trending-down", "repeat", "tag", "wallet", "star", "filter"];

  const canSave = name.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), color, icon });
  };

  return (
    <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: "-0.01em" }}>
          Nova visualização
        </div>
        <button
          onClick={onCancel}
          aria-label="Fechar"
          style={{
            ...G,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 6,
            border: "none", background: "transparent", color: T.inkLight,
            cursor: "pointer",
          }}
        >
          <Icon name="x" size={12} />
        </button>
      </div>

      {/* Preview do chip */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "9px 11px", borderRadius: 10,
          border: `1px dashed ${T.border}`,
          background: T.bg,
        }}
      >
        <div
          style={{
            width: 26, height: 26, borderRadius: 7,
            background: `${color}18`, color,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={13} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 12.5, fontWeight: 700, color: name.trim() ? T.ink : T.inkGhost, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name.trim() || "Nome da visualização"}
          </div>
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 2 }}>
            {activeFacets.length === 0 ? "Sem filtros" : `${activeFacets.length} ${activeFacets.length === 1 ? "filtro" : "filtros"}`}
          </div>
        </div>
      </div>

      {/* Nome */}
      <div>
        <FormLabel>Nome</FormLabel>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          placeholder="Ex.: Mercados do mês"
          style={{
            ...G,
            width: "100%", padding: "8px 11px",
            borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.surface, fontSize: 13, color: T.ink, outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.ink)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
      </div>

      {/* Ícone */}
      <div>
        <FormLabel>Ícone</FormLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
          {ICONS.map((i) => {
            const active = i === icon;
            return (
              <button
                key={i}
                onClick={() => setIcon(i)}
                style={{
                  ...G,
                  width: "100%", aspectRatio: "1 / 1",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 7,
                  border: `1px solid ${active ? color : T.border}`,
                  background: active ? `${color}15` : T.surface,
                  cursor: "pointer", padding: 0,
                }}
              >
                <Icon name={i} size={12} color={active ? color : T.inkMid} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Cor */}
      <div>
        <FormLabel>Cor</FormLabel>
        <div style={{ display: "flex", gap: 6 }}>
          {COLORS.map((c) => {
            const active = c === color;
            return (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  ...G,
                  width: 24, height: 24, borderRadius: 99,
                  background: c, cursor: "pointer", padding: 0,
                  border: `2px solid ${active ? T.surface : "transparent"}`,
                  boxShadow: active ? `0 0 0 2px ${c}` : "none",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {active && <Icon name="check" size={11} color="#fff" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtros aplicados */}
      <div>
        <FormLabel>Filtros aplicados</FormLabel>
        {activeFacets.length === 0 ? (
          <div
            style={{
              ...G, fontSize: 11.5, color: T.inkGhost,
              padding: "9px 11px", borderRadius: 8,
              background: T.bg, border: `1px dashed ${T.border}`,
              fontStyle: "italic",
            }}
          >
            Nenhum filtro ativo — será uma visualização vazia.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {activeFacets.map((f) => (
              <span
                key={f.label}
                style={{
                  ...G,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 9px", borderRadius: 99,
                  background: T.bg, border: `1px solid ${T.border}`,
                  fontSize: 11, color: T.inkMid,
                }}
              >
                <Icon name={f.icon} size={10} color={f.color} />
                <span style={{ color: T.inkLight }}>{f.label}:</span>
                <span style={{ color: T.ink, fontWeight: 600 }}>{f.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
        <button
          onClick={onCancel}
          style={{
            ...G,
            padding: "9px 14px", borderRadius: 8,
            border: `1px solid ${T.border}`, background: T.surface,
            color: T.inkMid, fontSize: 12.5, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            ...G,
            flex: 1, padding: "9px 14px", borderRadius: 8,
            border: `1px solid ${canSave ? T.ink : T.border}`,
            background: canSave ? T.ink : T.grayLight,
            color: canSave ? "#fff" : T.inkGhost,
            fontSize: 12.5, fontWeight: 700,
            cursor: canSave ? "pointer" : "not-allowed",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Icon name="save" size={12} color={canSave ? "#fff" : T.inkGhost} />
          Salvar visualização
        </button>
      </div>
    </div>
  );
}

function FormLabel({ children }) {
  return (
    <div
      style={{
        ...G, fontSize: 10, fontWeight: 700,
        color: T.inkMid, textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// ──────────────────── SORT MENU (multi-nível)
const SORT_FIELDS = {
  date: { label: "Data",      icon: "calendar",      dirLabels: { desc: "Mais recente primeiro", asc: "Mais antiga primeiro" } },
  val:  { label: "Valor",     icon: "trending",      dirLabels: { desc: "Maior valor primeiro",  asc: "Menor valor primeiro" } },
  tipo: { label: "Tipo",      icon: "filter",        dirLabels: { desc: "Receitas primeiro",     asc: "Despesas primeiro" } },
  desc: { label: "Descrição", icon: "arrow-up-down", dirLabels: { asc:  "A → Z",                 desc: "Z → A" } },
  cat:  { label: "Categoria", icon: "circle",        dirLabels: { asc:  "A → Z",                 desc: "Z → A" } },
};
const DEFAULT_DIR = { date: "desc", val: "desc", tipo: "desc", desc: "asc", cat: "asc" };

function SortMenu({ sort, setSort, onClose }) {
  const used = sort.map((r) => r.field);
  const inactive = Object.keys(SORT_FIELDS).filter((f) => !used.includes(f));

  const addRule = (field) => setSort([...sort, { field, dir: DEFAULT_DIR[field] }]);
  const removeRule = (i) => setSort(sort.filter((_, idx) => idx !== i));
  const toggleDir = (i) =>
    setSort(sort.map((r, idx) => idx === i ? { ...r, dir: r.dir === "asc" ? "desc" : "asc" } : r));
  const moveRule = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= sort.length) return;
    const next = [...sort];
    [next[i], next[j]] = [next[j], next[i]];
    setSort(next);
  };
  const resetDefault = () => setSort([{ field: "date", dir: "desc" }]);

  const isDefault = sort.length === 1 && sort[0].field === "date" && sort[0].dir === "desc";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", top: "calc(100% + 6px)", right: 0,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 10, boxShadow: T.lg,
        width: 384, padding: 6,
        zIndex: 80,
        animation: "fadeInDown 0.14s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 8px 8px",
        }}
      >
        <div
          style={{
            ...G, fontSize: 10, fontWeight: 700, color: T.inkMid,
            textTransform: "uppercase", letterSpacing: "0.08em",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <Icon name="arrow-up-down" size={11} />
          Ordenar por
          <span
            style={{
              ...G,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 16, height: 16, padding: "0 5px",
              borderRadius: 99, background: T.bg, color: T.inkMid,
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0,
            }}
          >
            {sort.length === 0 ? "Nenhum" : sort.length === 1 ? "1 nível" : `${sort.length} níveis`}
          </span>
        </div>
        {!isDefault && (
          <button
            onClick={resetDefault}
            style={{
              ...G,
              padding: "3px 7px", borderRadius: 6,
              border: "none", background: "transparent",
              fontSize: 10.5, fontWeight: 600, color: T.inkLight,
              cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Restaurar ordenação padrão"
          >
            Resetar
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 2px 2px" }}>
        {/* Active rules */}
        {sort.map((rule, i) => {
          const f = SORT_FIELDS[rule.field];
          return (
            <div
              key={rule.field}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 6px 6px 8px", borderRadius: 8,
                background: T.bg, border: `1px solid ${T.border}`,
              }}
            >
              <div
                style={{
                  ...G,
                  width: 18, height: 18, borderRadius: 5,
                  background: T.ink, color: "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}
                title={i === 0 ? "Critério principal" : `Critério ${i + 1}`}
              >
                {i + 1}
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <Icon name={f.icon} size={12} color={T.inkMid} />
                <span
                  style={{
                    ...G, fontSize: 12.5, fontWeight: 700, color: T.ink,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {f.label}
                </span>
              </div>

              <button
                onClick={() => toggleDir(i)}
                title="Inverter direção"
                style={{
                  ...G,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 8px", borderRadius: 6,
                  border: `1px solid ${T.border}`, background: T.surface,
                  color: T.inkMid, fontSize: 10.5, fontWeight: 600,
                  cursor: "pointer", letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.ink; e.currentTarget.style.color = T.ink; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkMid; }}
              >
                {f.dirLabels[rule.dir]}
                <span style={{ fontWeight: 800, color: T.ink, marginLeft: 1 }}>
                  {rule.dir === "asc" ? "↑" : "↓"}
                </span>
              </button>

              {sort.length > 1 && (
                <div style={{ display: "inline-flex", flexDirection: "column", gap: 0 }}>
                  <button
                    onClick={() => moveRule(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir prioridade"
                    style={{
                      ...G,
                      width: 14, height: 11, padding: 0,
                      border: "none", background: "transparent",
                      color: i === 0 ? T.inkGhost : T.inkLight,
                      cursor: i === 0 ? "default" : "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <svg width="9" height="6" viewBox="0 0 12 8" fill="none">
                      <path d="M2 6 L6 2 L10 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveRule(i, +1)}
                    disabled={i === sort.length - 1}
                    aria-label="Descer prioridade"
                    style={{
                      ...G,
                      width: 14, height: 11, padding: 0,
                      border: "none", background: "transparent",
                      color: i === sort.length - 1 ? T.inkGhost : T.inkLight,
                      cursor: i === sort.length - 1 ? "default" : "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <svg width="9" height="6" viewBox="0 0 12 8" fill="none">
                      <path d="M2 2 L6 6 L10 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
              <button
                onClick={() => removeRule(i)}
                aria-label="Remover nível"
                style={{
                  ...G,
                  width: 22, height: 22, borderRadius: 6,
                  border: "none", background: "transparent",
                  color: T.inkLight, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.redLight || "#FEF2F2"; e.currentTarget.style.color = T.red || "#DC2626"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.inkLight; }}
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          );
        })}

        {/* Separator */}
        {sort.length > 0 && inactive.length > 0 && (
          <div
            style={{
              ...G, fontSize: 9.5, fontWeight: 600, color: T.inkLight,
              textTransform: "uppercase", letterSpacing: "0.08em",
              padding: "8px 8px 2px",
            }}
          >
            Disponíveis · clique para adicionar
          </div>
        )}

        {/* Inactive fields (always visible, click to activate) */}
        {inactive.map((field) => {
          const f = SORT_FIELDS[field];
          const defaultDir = DEFAULT_DIR[field];
          return (
            <button
              key={field}
              onClick={() => addRule(field)}
              style={{
                ...G,
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 6px 6px 8px", borderRadius: 8,
                background: "transparent",
                border: `1px dashed ${T.border}`,
                cursor: "pointer", textAlign: "left",
                transition: "background 0.12s, border-color 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; e.currentTarget.style.borderColor = T.ink; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}
            >
              <div
                style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: T.surface, border: `1px solid ${T.border}`,
                  color: T.inkLight,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="plus" size={10} />
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <Icon name={f.icon} size={12} color={T.inkLight} />
                <span
                  style={{
                    ...G, fontSize: 12.5, fontWeight: 600, color: T.inkMid,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {f.label}
                </span>
              </div>

              <span
                style={{
                  ...G,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 8px", borderRadius: 6,
                  fontSize: 10.5, fontWeight: 500, color: T.inkLight,
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                }}
              >
                {f.dirLabels[defaultDir]}
                <span style={{ fontWeight: 700, marginLeft: 1, fontStyle: "normal" }}>
                  {defaultDir === "asc" ? "↑" : "↓"}
                </span>
              </span>
            </button>
          );
        })}

        {sort.length === 0 && inactive.length === 0 && (
          <div
            style={{
              ...G, fontSize: 11.5, color: T.inkGhost,
              padding: "16px 12px", textAlign: "center", fontStyle: "italic",
            }}
          >
            Sem campos disponíveis.
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────── DELETE VIEW CONTROL
function DeleteViewControl({ view, onDelete, variant, cardActive }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Estilos por variant
  const cornerStyle = {
    position: "absolute", top: 4, right: 4,
    width: 18, height: 18, borderRadius: 5,
    background: cardActive ? "rgba(255,255,255,0.18)" : T.surface,
    border: `1px solid ${cardActive ? "rgba(255,255,255,0.22)" : T.border}`,
    color: cardActive ? "#fff" : T.inkLight,
  };
  const inlineStyle = {
    width: 16, height: 16, borderRadius: 99,
    background: "transparent",
    border: "none",
    color: cardActive ? "rgba(255,255,255,0.7)" : T.inkLight,
    marginLeft: 1,
  };
  const rowStyle = {
    width: 22, height: 22, borderRadius: 6,
    background: "transparent",
    border: "none",
    color: T.inkLight,
  };
  const baseStyle = variant === "corner" ? cornerStyle : variant === "inline" ? inlineStyle : rowStyle;

  return (
    <span ref={ref} style={{ display: variant === "corner" ? "block" : "inline-flex", position: variant === "corner" ? "static" : "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        className={`delete-view-btn delete-view-${variant}${open ? " open" : ""}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={`Excluir ${view.label}`}
        title="Excluir visualização"
        style={{
          ...G,
          ...baseStyle,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", padding: 0,
          transition: "background 0.12s, color 0.12s, opacity 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = cardActive
            ? "rgba(255,255,255,0.25)"
            : T.redLight || "#FEF2F2";
          e.currentTarget.style.color = cardActive ? "#fff" : (T.red || "#DC2626");
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = baseStyle.background;
          e.currentTarget.style.color = baseStyle.color;
        }}
      >
        <Icon name="x" size={variant === "inline" ? 9 : 10} />
      </button>
      {open && (
        <DeleteConfirmPopover
          viewLabel={view.label}
          color={view.color}
          icon={view.icon}
          anchor={variant}
          onCancel={() => setOpen(false)}
          onConfirm={() => { onDelete(view.id); setOpen(false); }}
        />
      )}
    </span>
  );
}

function DeleteConfirmPopover({ viewLabel, color, icon, anchor, onCancel, onConfirm }) {
  const posStyle =
    anchor === "corner"
      ? { position: "absolute", top: 28, right: -4 }
      : anchor === "row"
      ? { position: "absolute", top: "calc(100% + 4px)", right: 0 }
      : { position: "absolute", top: "calc(100% + 6px)", right: -4 };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        ...posStyle,
        width: 240,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: T.lg,
        padding: 12,
        zIndex: 90,
        animation: "fadeInDown 0.14s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: 7,
            background: `${color}15`, color,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={12} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>
            Excluir esta visualização?
          </div>
          <div
            style={{
              ...G, fontSize: 11, color: T.inkLight, marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            “{viewLabel}”
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onCancel}
          style={{
            ...G,
            flex: 1, padding: "7px 10px", borderRadius: 7,
            border: `1px solid ${T.border}`, background: T.surface,
            color: T.inkMid, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          autoFocus
          style={{
            ...G,
            flex: 1, padding: "7px 10px", borderRadius: 7,
            border: `1px solid ${T.red || "#DC2626"}`,
            background: T.red || "#DC2626",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          <Icon name="x" size={10} color="#fff" strokeWidth={2.6} />
          Excluir
        </button>
      </div>
    </div>
  );
}

// Hover-reveal dos botões de delete (só visível quando o pai está em hover ou o popover está aberto)
(() => {
  if (typeof document === "undefined") return;
  if (document.getElementById("delete-view-styles")) return;
  const s = document.createElement("style");
  s.id = "delete-view-styles";
  s.textContent = `
    .delete-view-btn { opacity: 0; pointer-events: none; }
    .saved-view-card:hover .delete-view-corner,
    .saved-view-pill:hover .delete-view-inline,
    .saved-view-row:hover .delete-view-row,
    .delete-view-btn.open,
    .delete-view-btn:focus-visible { opacity: 1; pointer-events: auto; }
  `;
  document.head.appendChild(s);
})();

// ──────────────────── SORT TOOLTIP (hover do botão de ordenação)
function SortTooltip({ rules }) {
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute", top: "calc(100% + 6px)", right: 0,
        background: T.ink, color: "#fff",
        borderRadius: 8, padding: "8px 10px",
        boxShadow: T.lg,
        zIndex: 75, pointerEvents: "none",
        minWidth: 200, maxWidth: 280,
        animation: "fadeInDown 0.12s ease",
      }}
    >
      <div
        style={{
          ...G, fontSize: 9.5, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.55)",
          marginBottom: 6,
        }}
      >
        {rules.length === 1 ? "Ordenando por" : `Ordenando por ${rules.length} critérios`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rules.map((rule, i) => {
          const f = SORT_FIELDS[rule.field];
          return (
            <div
              key={rule.field}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              <span
                style={{
                  ...G,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 14, height: 14, borderRadius: 4,
                  background: "rgba(255,255,255,0.18)", color: "#fff",
                  fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <Icon name={f.icon} size={11} color="rgba(255,255,255,0.7)" />
              <span style={{ ...G, fontSize: 11.5, fontWeight: 600, color: "#fff" }}>
                {f.label}
              </span>
              <span style={{ ...G, fontSize: 11, color: "rgba(255,255,255,0.7)", flex: 1 }}>
                · {f.dirLabels[rule.dir]}
              </span>
              <span style={{ fontWeight: 800, color: "#fff", fontSize: 12 }}>
                {rule.dir === "asc" ? "↑" : "↓"}
              </span>
            </div>
          );
        })}
      </div>
      {/* arrow */}
      <div
        style={{
          position: "absolute", top: -4, right: 14,
          width: 8, height: 8, background: T.ink,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

window.VariationC = VariationC;
// Exports para o scaffold de screenshots / galeria de componentes do handoff
Object.assign(window, {
  NewViewForm,
  SortMenu,
  SortTooltip,
  DeleteConfirmPopover,
  SavedViewsCards,
  FacetPanelContent,
  SORT_FIELDS,
  DEFAULT_DIR,
});
