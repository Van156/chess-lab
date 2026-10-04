import { authClient } from "@/app/auth-client";
import { isSuperadminRole } from "@/features/access-control";

import type { NavContext } from "./navigation";

/** The context the sidebar and section tabs evaluate their `visible` predicates with. */
export function useNavContext(): NavContext {
  const { data: session } = authClient.useSession();
  return { isSuperadmin: isSuperadminRole(session?.user.role) };
}
