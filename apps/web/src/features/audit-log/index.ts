/** Public API of the audit-log feature (spec §4.4). Everything else is internal. */
export { default as PlatformActivityPage } from "./components/platform-activity-page";
export { default as SelfSecurityLog } from "./components/self-security-log";
export { default as UserActivityLog } from "./components/user-activity-log";
export {
  createUserAuditTabSearchSchema,
  platformAuditSearchDefaults,
  platformAuditSearchSchema,
  userAuditSearchConfig,
  userAuditSearchDefaults,
  userAuditSearchSchema,
  type UserAuditSearch,
} from "./lib/audit-log-search";
