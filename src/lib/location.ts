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

export function isAndroidAppContext() {
  const android = /Android/i.test(navigator.userAgent || '');
  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return android && standalone;
}

export function isNativeAndroidApp() {
  return /SecureTrackNative\//i.test(navigator.userAgent || '');
}

function messageForError(error: GeolocationPositionError) {
  if (error.code === 1) {
    if (isNativeAndroidApp()) {
      return 'Location permission is blocked for SecureTrack. Open Android Settings › Apps › SecureTrack › Permissions › Location, choose Allow while using the app, then tap Try again.';
    }
    if (isAndroidAppContext()) {
      return 'Location is blocked for this site. In Chrome, open Settings › Site settings › Location and allow SecureTrack. Also keep Android Settings › Apps › Chrome › Permissions › Location set to Allow while using the app, then tap Try again.';
    }
    return 'Location permission is blocked for SecureTrack. Allow location for this site or PWA, then tap Try again.';
  }
  if (error.code === 2) {
    return 'The phone could not determine its position. Turn on Location Services and Wi-Fi or mobile data, then try again near a window.';
  }
  return 'The phone is still waiting for a location. Keep SecureTrack open and tap Try again.';
}

function watchForPosition(options: PositionOptions) {
  return new Promise<LocationFix>((resolve, reject) => {
    let watchId: number | undefined;
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      action();
    };
    watchId = navigator.geolocation.watchPosition(
      position => finish(() => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
      })),
      error => finish(() => reject(new LocationError(messageForError(error), error.code))),
      options,
    );
  });
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

  // Keep one request active while Chrome resolves the site permission and GPS
  // fix inside an installed Android app.
  if (isAndroidAppContext() && typeof (navigator.geolocation as Partial<Geolocation>).watchPosition === 'function') {
    return watchForPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    });
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
