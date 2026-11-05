import { authClient } from "@/app/auth-client";
import { useFeatureFlags } from "@/app/use-feature-flags";
import Loader from "@/shared/components/feedback/loader";

import type { AuthSearch } from "../lib/auth-search";
import AuthCard from "./auth-card";
import SignInForm from "./sign-in-form";

/** `/sign-in`: the sign-in form inside the split `AuthCard`; email sign-up is offered only when the `emailSignUp` flag is on. */
export default function SignInPage({ search }: { search?: AuthSearch }) {
  const { isPending } = authClient.useSession();
  const { emailSignUp } = useFeatureFlags();
  return (
    <AuthCard title="Welcome back" description="Sign in to your account">
      {isPending ? <Loader /> : <SignInForm search={search} showSignUp={emailSignUp} />}
    </AuthCard>
  );
}
