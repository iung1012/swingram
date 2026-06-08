import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { SpiralLoaderBlock } from "@/components/spiral-loader";

const MapView = lazy(() => import("@/components/map-view"));

export const Route = createFileRoute("/_authenticated/map")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mapa — Brasa Swing" }] }),
  component: MapPage,
});

function MapPage() {
  return (
    <ClientOnly fallback={<SpiralLoaderBlock label="Carregando mapa" />}>
      <Suspense fallback={<SpiralLoaderBlock label="Carregando mapa" />}>
        <MapView />
      </Suspense>
    </ClientOnly>
  );
}
