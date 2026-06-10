import { createFileRoute, redirect } from "@tanstack/react-router";
import { api } from "@/integrations/api/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await api.auth.getUser();
    if (data.user) throw redirect({ to: "/home" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});

