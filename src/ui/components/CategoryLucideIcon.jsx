import React from "react";
import { Tag } from "lucide-react";
import { resolveCategoryIconKey } from "../data/categoryLabels.js";
import { getCategoryLucideIcon } from "../data/categoryLucideIcons.js";

/**
 * Ícone de categoria: `icon_key` da API; senão deriva do rótulo PT (mock/legado); fallback Lucide Tag.
 */
export function CategoryLucideIcon({
  iconKey = null,
  labelPt = "",
  size = 14,
  color,
  strokeWidth = 2,
}) {
  const resolved = resolveCategoryIconKey(iconKey, labelPt);
  const IconComp = getCategoryLucideIcon(resolved) || Tag;
  return <IconComp size={size} color={color} strokeWidth={strokeWidth} />;
}
