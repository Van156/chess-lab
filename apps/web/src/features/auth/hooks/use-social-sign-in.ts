import { useEffect, useState } from "react";

import { authClient } from "@/app/auth-client";

import { runAuthAction } from "../lib/run-auth-action";
import { isBfcacheRestore, type SocialProviderId } from "../lib/social-providers";
import { useEnabledProviders } from "./use-enabled-providers";

/**
 * Container logic for the social provider buttons (R5.2, R5.3): calls
 * `authClient.signIn.social`, which redirects the browser to the provider. Stays
 * pending once the redirect starts; on an error result or a rejected promise the
 * pending state clears and `onError` receives the message for the inline alert.
 */
export function useSocialSignIn({
  callbackURL,
  errorCallbackURL,
  onError,
}: {
  callbackURL: string;
  errorCallbackURL: string;
  onError: (message: string) => void;
}) {
  const providers = useEnabledProviders();
  const [pendingProvider, setPendingProvider] = useState<SocialProviderId | null>(null);

  // Back from the provider can restore this page from the bfcache with the old
  // pending state; clear it so the buttons are usable again.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (isBfcacheRestore(event)) {
        setPendingProvider(null);
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function select(provider: SocialProviderId) {
    setPendingProvider(provider);
    const result = await runAuthAction(() =>
      authClient.signIn.social({ provider, callbackURL, errorCallbackURL }),
    );
    if (!result.ok) {
      setPendingProvider(null);
      onError(result.message);
    }
  }

  return { providers, pendingProvider, select };
}
