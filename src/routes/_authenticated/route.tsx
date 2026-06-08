import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Use getSession (reads from localStorage, no network) to avoid intermittent
    // "Load failed" fetch aborts on Safari right after sign-in navigation.
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Fallback to network check in case session hasn't been hydrated yet.
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const refreshed = await supabase.auth.getSession();
          session = refreshed.data.session;
        }
      } catch {
        // network error — fall through to redirect
      }
    }
    if (!session?.user) throw redirect({ to: "/auth" });
    const user = session.user;
    // Check profile completion
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.onboarding_complete && !location.pathname.startsWith("/onboarding")) {
      throw redirect({ to: "/onboarding" });
    }
    return { user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <BottomNav />
    </div>
  );
}
