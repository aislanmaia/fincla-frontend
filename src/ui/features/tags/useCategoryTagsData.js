import { useEffect, useMemo, useState } from "react";
import {
  formatTagsApiError,
  listCategoryTagsForUi,
  mapCategoryTagsForUi,
  mapCategoryTagsToOptions,
} from "../../data/tagsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  error: "",
  options: [],
  categories: [],
};

export function useCategoryTagsData({ organizationId, enabled = true }) {
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    setState((current) => ({
      ...current,
      isLoading: true,
      error: "",
    }));

    listCategoryTagsForUi(organizationId)
      .then((response) => {
        if (cancelled) return;
        const raw = response.tags ?? [];
        setState({
          isLoading: false,
          error: "",
          categories: mapCategoryTagsForUi(raw),
          options: mapCategoryTagsToOptions(raw),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          isLoading: false,
          error: formatTagsApiError(error),
          options: [],
          categories: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  return useMemo(() => state, [state]);
}
