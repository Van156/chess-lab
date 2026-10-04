// Browser-safe re-export of the canonical list vocabulary (it lives in `@b2c-template/db`,
// the lowest package every consumer can import). The web app depends on `@b2c-template/api`,
// not on `@b2c-template/db`, so it reaches the vocabulary through this module.
export {
  FILTER_OPERATORS,
  FILTER_VARIANTS,
  getServerOperators,
  JOIN_OPERATORS,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTERS,
  MAX_SORT_ITEMS,
  OPERATORS_BY_VARIANT,
  SERVER_OPERATORS,
} from "@b2c-template/db/lib/list-vocabulary";
export { getMaxPage, MAX_OFFSET } from "@b2c-template/db/lib/pagination";
export type {
  FilterOperator,
  FilterVariant,
  JoinOperator,
  ServerFilterOperator,
} from "@b2c-template/db/lib/list-vocabulary";
