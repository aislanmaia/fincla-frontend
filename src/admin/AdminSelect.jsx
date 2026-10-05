import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function AdminSelect({ id, name, value, onChange, options, ariaLabel, required = false, disabled = false }) {
  const generatedId = useId();
  const listId = `admin-select-${generatedId}`;
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex] || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function choose(option) {
    onChange(option.value);
    setOpen(false);
    root.current?.querySelector('[role="combobox"]')?.focus();
  }

  function keyDown(event) {
    if (disabled) return;
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) { setActive(Math.max(selectedIndex, 0)); setOpen(true); return; }
      setActive((current) => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    }
    if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      choose(options[active]);
    }
  }

  return <div className={`admin-select ${open ? "is-open" : ""}`} ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {name && <input type="hidden" name={name} value={value} />}
    <button id={id} type="button" role="combobox" aria-label={ariaLabel} aria-required={required || undefined} aria-controls={listId} aria-expanded={open} aria-haspopup="listbox" aria-activedescendant={open ? `${listId}-option-${active}` : undefined} disabled={disabled} onKeyDown={keyDown} onClick={() => { setActive(Math.max(selectedIndex, 0)); setOpen((current) => !current); }}>
      <span>{selected?.label || "Selecione"}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div id={listId} className="admin-select-menu" role="listbox" aria-label={ariaLabel}>
      {options.map((option, index) => <button id={`${listId}-option-${index}`} key={option.value} type="button" role="option" aria-selected={value === option.value} className={active === index ? "is-active" : ""} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
        <span>{option.label}</span>{value === option.value && <Check size={15} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
