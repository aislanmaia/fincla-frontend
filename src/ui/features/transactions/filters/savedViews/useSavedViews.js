import { useCallback, useEffect, useState } from "react";
import { buildNewView, buildUpdatedView } from "./savedViewsModel.js";
import { readSavedViews, writeSavedViews } from "./savedViewsStorage.js";

/**
 * Hook que mantém a coleção de saved views de uma organização.
 * Lê do localStorage no bootstrap e grava após cada mutação.
 *
 * Quando `organizationId` for nulo, opera em memória (sem persistência).
 */
export function useSavedViews(organizationId) {
  const [views, setViews] = useState(() => readSavedViews(organizationId));

  useEffect(() => {
    setViews(readSavedViews(organizationId));
  }, [organizationId]);

  const persist = useCallback(
    (next) => {
      setViews(next);
      if (organizationId) writeSavedViews(organizationId, next);
    },
    [organizationId],
  );

  const createView = useCallback(
    ({ name, icon, color, filters }) => {
      const view = buildNewView({ name, icon, color, filters });
      if (!view) return null;
      persist([...views, view]);
      return view;
    },
    [views, persist],
  );

  const removeView = useCallback(
    (id) => {
      persist(views.filter((v) => v.id !== id));
    },
    [views, persist],
  );

  const updateView = useCallback(
    ({ id, name, icon, color, filters }) => {
      const existing = views.find((v) => v.id === id);
      if (!existing) return null;
      const updated = buildUpdatedView(existing, { name, icon, color, filters });
      if (!updated) return null;
      persist(views.map((v) => (v.id === id ? updated : v)));
      return updated;
    },
    [views, persist],
  );

  return { views, createView, updateView, removeView };
}
