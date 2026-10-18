const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export const haversineKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

/** A lat/lng box that contains the circle; cheap to filter on in SQL. */
export const boundingBox = (
  center: { latitude: number; longitude: number },
  radiusKm: number,
) => {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos(toRadians(center.latitude)));
  return {
    minLat: center.latitude - dLat,
    maxLat: center.latitude + dLat,
    minLng: center.longitude - dLng,
    maxLng: center.longitude + dLng,
  };
};

/**
 * A provider's pickup point as shown publicly: rounded to ~1 km so the map
 * shows the neighbourhood, not the doorstep. The exact point is shared only
 * on a paid order.
 */
export const approximate = (latitude: number | null, longitude: number | null) =>
  latitude === null || longitude === null
    ? null
    : {
        latitude: Math.round(latitude * 100) / 100,
        longitude: Math.round(longitude * 100) / 100,
      };

export const parseLatLng = (value?: string) => {
  if (!value) return null;
  const [latitude, longitude] = value.split(",").map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude: latitude!, longitude: longitude! };
};
