import { useEffect, useState } from "react";
import type { User } from "@/integrations/api/client";
import { api } from "@/integrations/api/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = api.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    api.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

