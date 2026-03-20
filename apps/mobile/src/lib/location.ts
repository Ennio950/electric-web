import * as Location from 'expo-location';

export type ForegroundCoords = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export async function getCurrentForegroundCoords(): Promise<ForegroundCoords> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Permiso de ubicacion denegado. Habilitalo en Settings para compartir tu ubicacion.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  };
}
