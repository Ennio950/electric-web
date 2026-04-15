import * as Location from 'expo-location';

export type ForegroundCoords = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

type GetCurrentForegroundCoordsOptions = {
  fallbackAddress?: string | null;
};

function toForegroundCoords(
  coords: Pick<Location.LocationObjectCoords, 'latitude' | 'longitude' | 'accuracy'>,
): ForegroundCoords {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
  };
}

async function getGeocodedFallback(address: string | null | undefined): Promise<ForegroundCoords | null> {
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  if (!normalizedAddress) {
    return null;
  }

  try {
    const results = await Location.geocodeAsync(normalizedAddress);
    const firstMatch = results[0];
    if (!firstMatch) {
      return null;
    }

    return {
      lat: firstMatch.latitude,
      lng: firstMatch.longitude,
      accuracy: null,
    };
  } catch {
    return null;
  }
}

export async function getCurrentForegroundCoords(
  options: GetCurrentForegroundCoordsOptions = {},
): Promise<ForegroundCoords> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Permiso de ubicacion denegado. Habilitalo en Settings para compartir tu ubicacion.');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);

  if (servicesEnabled) {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      return toForegroundCoords(position.coords);
    } catch {
      // Fall through to last-known/geocoded fallback below.
    }
  }

  try {
    const lastKnownPosition = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60_000,
      requiredAccuracy: 2_500,
    });

    if (lastKnownPosition?.coords) {
      return toForegroundCoords(lastKnownPosition.coords);
    }
  } catch {
    // Ignore and continue to the address fallback.
  }

  const geocodedFallback = await getGeocodedFallback(options.fallbackAddress);
  if (geocodedFallback) {
    return geocodedFallback;
  }

  if (!servicesEnabled) {
    throw new Error(
      'La ubicacion del dispositivo esta apagada y no habia una ubicacion previa util. Activa Location o revisa la direccion del servicio.',
    );
  }

  throw new Error(
    'No pude obtener tu ubicacion actual en este momento. Intenta de nuevo o verifica el GPS del dispositivo.',
  );
}
