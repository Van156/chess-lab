import type { Database } from "@b2c-template/db";
import { buildListQuery, countListRows } from "@b2c-template/db/lib/list-query";
import type { ListColumns, ListFilter, ListQueryInput } from "@b2c-template/db/lib/list-query";
import { user } from "@b2c-template/db/schema/auth";
import { and, not, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/** One row as read back for the platform-wide user listing (R6.2). */
export type PlatformUserRow = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A page of users plus the number of users matching the filters (ignoring paging). */
export type PlatformUserPage = {
  users: PlatformUserRow[];
  total: number;
};

/** List-input ids to `user` columns. `status` is derived from `banned`, not a column. */
export const PLATFORM_USER_LIST_COLUMNS = {
  email: user.email,
  name: user.name,
  role: user.role,
  createdAt: user.createdAt,
} as const satisfies ListColumns;

/** A filter on a derived user column whose operator or value shape the listing cannot express. */
export class UnsupportedFilterError extends Error {
  override readonly name = "UnsupportedFilterError";
}

const USER_DERIVED_FILTER_IDS = ["role", "status"] as const;
type UserDerivedFilterId = (typeof USER_DERIVED_FILTER_IDS)[number];

const isDerivedFilterId = (id: string): id is UserDerivedFilterId =>
  (USER_DERIVED_FILTER_IDS as readonly string[]).includes(id);

/** The values of the derived `status` column. */
const USER_STATUSES = ["active", "banned"] as const;
type UserStatus = (typeof USER_STATUSES)[number];

const isUserStatus = (value: string): value is UserStatus =>
  (USER_STATUSES as readonly string[]).includes(value);

const isStringList = (value: ListFilter["value"]): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const describeValue = (value: ListFilter["value"]) =>
  Array.isArray(value) ? "array" : typeof value;

/**
 * Rows with the given statuses; a NULL `banned` counts as active, so the statuses partition every row.
 */
function statusCondition(wantBanned: boolean, wantActive: boolean): SQL {
  const isBanned = sql`${user.banned} is true`;
  if (wantBanned && wantActive) {
    return sql`true`;
  }
  if (wantBanned) {
    return isBanned;
  }
  if (wantActive) {
    return not(isBanned);
  }
  return sql`false`;
}

/**
 * Condition for a derived-column filter, or `undefined` for a plain column. Unhandled operators or
 * shapes throw `UnsupportedFilterError`. An empty `inArray` matches no row; an empty `notInArray` matches all.
 * See docs/architecture/auth.md#platform-lists
 */
function userFilterCondition(filter: ListFilter): SQL | undefined {
  const { id, operator, value } = filter;
  if (!isDerivedFilterId(id)) {
    return undefined;
  }
  const unsupported = () =>
    new UnsupportedFilterError(
      `Unsupported ${id} filter: operator "${operator}" with ${describeValue(value)} value`,
    );

  switch (id) {
    case "role":
      return roleCondition(operator, value, unsupported);
    case "status":
      return statusFilterCondition(operator, value, unsupported);
    default:
      return id satisfies never;
  }
}

function roleCondition(
  operator: ListFilter["operator"],
  value: ListFilter["value"],
  unsupported: () => Error,
): SQL {
  const roles = sql`coalesce(string_to_array(${user.role}, ','), '{}'::text[])`;
  switch (operator) {
    case "isEmpty":
      return sql`cardinality(${roles}) = 0`;
    case "isNotEmpty":
      return sql`cardinality(${roles}) > 0`;
    case "eq":
    case "ne": {
      if (typeof value !== "string") {
        throw unsupported();
      }
      const hasRole = sql`${value} = any(${roles})`;
      return operator === "eq" ? hasRole : not(hasRole);
    }
    case "inArray":
    case "notInArray": {
      if (!isStringList(value)) {
        throw unsupported();
      }
      if (value.length === 0) {
        return operator === "inArray" ? sql`false` : sql`true`;
      }
      const wanted = sql`array[${sql.join(
        value.map((role) => sql`${role}`),
        sql`, `,
      )}]::text[]`;
      const hasAny = sql`${roles} && ${wanted}`;
      return operator === "inArray" ? hasAny : not(hasAny);
    }
    default:
      throw unsupported();
  }
}

function statusFilterCondition(
  operator: ListFilter["operator"],
  value: ListFilter["value"],
  unsupported: () => Error,
): SQL {
  switch (operator) {
    // A status is never empty.
    case "isEmpty":
      return sql`false`;
    case "isNotEmpty":
      return sql`true`;
    case "eq":
    case "ne": {
      if (typeof value !== "string" || !isUserStatus(value)) {
        throw unsupported();
      }
      const negate = operator === "ne";
      return statusCondition((value === "banned") !== negate, (value === "active") !== negate);
    }
    case "inArray":
    case "notInArray": {
      if (!isStringList(value) || !value.every(isUserStatus)) {
        throw unsupported();
      }
      const negate = operator === "notInArray";
      return statusCondition(
        value.includes("banned") !== negate,
        value.includes("active") !== negate,
      );
    }
    default:
      throw unsupported();
  }
}

/**
 * Every user filtered, sorted and paged (R6.2). Unlike better-auth's `list-users`, a
 * database failure rejects. Callers MUST gate it behind `user:list`.
 * See docs/architecture/auth.md#platform-lists
 */
export async function listPlatformUsers(
  db: Pick<Database, "select">,
  input: ListQueryInput,
): Promise<PlatformUserPage> {
  const derived: SQL[] = [];
  const plain: ListFilter[] = [];
  for (const filter of input.filters) {
    const condition = userFilterCondition(filter);
    if (condition) {
      derived.push(condition);
    } else {
      plain.push(filter);
    }
  }

  const query = buildListQuery({
    columns: PLATFORM_USER_LIST_COLUMNS,
    input: { ...input, filters: plain },
    tieBreakers: [user.id],
  });
  const conditions = [...derived, ...(query.where ? [query.where] : [])];
  const where = input.joinOperator === "or" ? or(...conditions) : and(...conditions);

  const [users, total] = await Promise.all([
    db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(where)
      .orderBy(...query.orderBy)
      .limit(query.limit)
      .offset(query.offset),
    countListRows(db, user, where),
  ]);
  return { users, total };
}
