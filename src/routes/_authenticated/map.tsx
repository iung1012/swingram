import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";

const MapView = lazy(() => import("@/components/map-view"));

export const Route = createFileRoute("/_authenticated/map")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mapa — Spark" }] }),
  component: MapPage,
});

function MapPage() {
  return (
    <ClientOnly fallback={<div className="mx-auto max-w-2xl px-4 pt-6">Carregando mapa…</div>}>
      <Suspense fallback={<div className="mx-auto max-w-2xl px-4 pt-6">Carregando mapa…</div>}>
        <MapView />
      </Suspense>
    </ClientOnly>
  );
}
