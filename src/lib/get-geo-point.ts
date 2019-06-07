/**
 * Returns normalized geo point object from geoJSON, {lat, lng} or {lattitude,longutude,altitude}
 *
 * @param {number[] | { lat: number, lng: number, alt?: number } | { longitude: number, latitude: number, altitude?: number }} point
 * @returns {{ longitude: number, latitude: number, altitude?: number }}
 * @throws on unknown point format
 */
export function getGeoPoint(
  point:
    | readonly number[]
    | { lat: number; lng: number; alt?: number }
    | { longitude: number; latitude: number } & (
        | { altitude?: number }
        | { elevation?: number }),
): { longitude: number; latitude: number; altitude?: number } {
  if (!point) throw new Error("Can't get coordinates from undefined");

  // GeoJSON Array [longitude, latitude(, elevation)]
  if (Array.isArray(point)) {
    if (point.length < 2 || !point.every(n => Number.isFinite(n)))
      throw new Error(
        `Invalid GeoJSON array of numbers, length must be 2 to 3, received ${point.length}`,
      );
    return {
      longitude: point[0],
      latitude: point[1],
      altitude: point[2],
    };
  }

  // it can be an object with both lat and lng properties
  if ('lat' in point && 'lng' in point) {
    return {
      longitude: point.lng,
      latitude: point.lat,
      altitude: point.alt,
    };
  }

  if ('longitude' in point && 'latitude' in point) {
    // returning a copy
    return {
      longitude: point.longitude,
      latitude: point.latitude,
      altitude:
        'altitude' in point
          ? point.altitude
          : 'elevation' in point
          ? point.elevation
          : undefined,
    };
  }

  // If we are here it means we can't understand what a hell is it
  throw new Error(`Unknown geo point format: ${JSON.stringify(point)}`);
}
