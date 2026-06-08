// Fuzz lat/lng to a ~500m grid + a deterministic per-user offset.
// Never store the user's real coordinates.
const GRID_DEG = 0.0045; // ≈ 500m at the equator

function hashOffset(userId: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const lat = ((h % 1000) / 1000 - 0.5) * GRID_DEG;
  const lng = (((h >> 10) % 1000) / 1000 - 0.5) * GRID_DEG;
  return { lat, lng };
}

export function snapAndFuzz(userId: string, lat: number, lng: number) {
  const off = hashOffset(userId);
  return {
    lat_snap: Math.round(lat / GRID_DEG) * GRID_DEG + off.lat,
    lng_snap: Math.round(lng / GRID_DEG) * GRID_DEG + off.lng,
  };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
