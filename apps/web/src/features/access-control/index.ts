/** Public API of the access-control feature (spec §4.4): platform-level (superadmin) checks only. Everything else is internal. */
export { usePlatformCan } from "./hooks/use-platform-can";
export { hasPermissionLoadError } from "./lib/permission-load-error";
export { isSuperadminRole } from "./lib/platform-role";
