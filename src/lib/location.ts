export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy_m: number;
}

export class LocationError extends Error {
  constructor(message: string, public code: number) {
    super(message);
  }
}

function messageForError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'SecureTrack is blocked from using this phone’s location. Allow location for this site or PWA, then tap Try again.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'The phone could not determine its position. Turn on Location Services and Wi-Fi or mobile data, then try again near a window.';
  }
  return 'The phone is still waiting for a location. Keep SecureTrack open and tap Try again.';
}

function requestPosition(options: PositionOptions) {
  return new Promise<LocationFix>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
      }),
      error => reject(new LocationError(messageForError(error), error.code)),
      options,
    );
  });
}

export async function captureLocation(): Promise<LocationFix> {
  if (!window.isSecureContext || !navigator.geolocation) {
    throw new LocationError('Location is unavailable in this browser. Open the live SecureTrack site in Safari or Chrome and try again.', 2);
  }

  // A recent operating-system fix is fast and reliable inside an installed iOS PWA.
  // If none exists, ask the GPS sensor for a fresh, more accurate position.
  try {
    return await requestPosition({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 120000,
    });
  } catch (error) {
    if (error instanceof LocationError && error.code === 1) throw error;
    return requestPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    });
  }
}
