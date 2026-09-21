import { useEffect, useMemo, useState } from "react";
import {
  formatTagsApiError,
  mapCategoryCatalogForUi,
} from "../../data/tagsAdapter.js";
import { getCategoryCatalog } from "../../../api/tags";
import { APP_UI_LOCALE } from "../../appLocale.js";

const EMPTY_STATE = {
  isLoading: false,
  error: "",
  options: [],
  categories: [],
};

export function useCategoryTagsData({ organizationId, transactionType = "expense", enabled = true }) {
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

    getCategoryCatalog(organizationId, transactionType, APP_UI_LOCALE)
      .then((response) => {
        if (cancelled) return;
        const categories = mapCategoryCatalogForUi(response.categories ?? []);
        setState({
          isLoading: false,
          error: "",
          categories,
          options: categories.map((category) => category.labelPt),
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
  }, [enabled, organizationId, transactionType]);

  return useMemo(() => state, [state]);
}
