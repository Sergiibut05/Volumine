/*
  Coordenadas de sitios conocidos, para rellenarlas solas al escribir el nombre.

  "Latitud 40,4 / longitud −3,7" no significa nada para quien está montando una
  gráfica de usuarios por ciudad; "Madrid" sí. Escribes el nombre en la fila y
  las coordenadas se ponen solas.

  SOLO LO USA EL EDITOR. No entra en el bundle de /embed —allí las coordenadas
  ya vienen resueltas en el config— así que este listado no gasta ni un byte del
  presupuesto y puede crecer todo lo que haga falta.

  Latitud: −90 (sur) a 90 (norte). Longitud: −180 (oeste) a 180 (este).
*/

export type Place = { name: string; lat: number; lon: number };

export const PLACES: Place[] = [
  // España
  { name: 'Madrid', lat: 40.42, lon: -3.7 },
  { name: 'Barcelona', lat: 41.39, lon: 2.17 },
  { name: 'Valencia', lat: 39.47, lon: -0.38 },
  { name: 'Sevilla', lat: 37.39, lon: -6.0 },
  { name: 'Bilbao', lat: 43.26, lon: -2.93 },
  { name: 'Málaga', lat: 36.72, lon: -4.42 },
  { name: 'Zaragoza', lat: 41.65, lon: -0.89 },
  { name: 'Palma', lat: 39.57, lon: 2.65 },
  { name: 'Las Palmas', lat: 28.12, lon: -15.43 },
  { name: 'España', lat: 40.0, lon: -4.0 },

  // Europa
  { name: 'Londres', lat: 51.51, lon: -0.13 },
  { name: 'París', lat: 48.86, lon: 2.35 },
  { name: 'Berlín', lat: 52.52, lon: 13.4 },
  { name: 'Roma', lat: 41.9, lon: 12.5 },
  { name: 'Milán', lat: 45.46, lon: 9.19 },
  { name: 'Ámsterdam', lat: 52.37, lon: 4.9 },
  { name: 'Lisboa', lat: 38.72, lon: -9.14 },
  { name: 'Oporto', lat: 41.15, lon: -8.61 },
  { name: 'Dublín', lat: 53.35, lon: -6.26 },
  { name: 'Bruselas', lat: 50.85, lon: 4.35 },
  { name: 'Viena', lat: 48.21, lon: 16.37 },
  { name: 'Zúrich', lat: 47.38, lon: 8.54 },
  { name: 'Múnich', lat: 48.14, lon: 11.58 },
  { name: 'Copenhague', lat: 55.68, lon: 12.57 },
  { name: 'Estocolmo', lat: 59.33, lon: 18.07 },
  { name: 'Oslo', lat: 59.91, lon: 10.75 },
  { name: 'Helsinki', lat: 60.17, lon: 24.94 },
  { name: 'Varsovia', lat: 52.23, lon: 21.01 },
  { name: 'Praga', lat: 50.08, lon: 14.44 },
  { name: 'Budapest', lat: 47.5, lon: 19.04 },
  { name: 'Atenas', lat: 37.98, lon: 23.73 },
  { name: 'Estambul', lat: 41.01, lon: 28.98 },
  { name: 'Moscú', lat: 55.76, lon: 37.62 },
  { name: 'Reino Unido', lat: 54.0, lon: -2.0 },
  { name: 'Francia', lat: 46.6, lon: 2.4 },
  { name: 'Alemania', lat: 51.2, lon: 10.4 },
  { name: 'Italia', lat: 42.8, lon: 12.6 },
  { name: 'Portugal', lat: 39.6, lon: -8.0 },
  { name: 'Países Bajos', lat: 52.2, lon: 5.3 },

  // América
  { name: 'Nueva York', lat: 40.71, lon: -74.01 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Los Ángeles', lat: 34.05, lon: -118.24 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Miami', lat: 25.76, lon: -80.19 },
  { name: 'Seattle', lat: 47.61, lon: -122.33 },
  { name: 'Austin', lat: 30.27, lon: -97.74 },
  { name: 'Boston', lat: 42.36, lon: -71.06 },
  { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Vancouver', lat: 49.28, lon: -123.12 },
  { name: 'Ciudad de México', lat: 19.43, lon: -99.13 },
  { name: 'Guadalajara', lat: 20.66, lon: -103.35 },
  { name: 'Bogotá', lat: 4.71, lon: -74.07 },
  { name: 'Lima', lat: -12.05, lon: -77.04 },
  { name: 'Santiago', lat: -33.45, lon: -70.67 },
  { name: 'Buenos Aires', lat: -34.6, lon: -58.38 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Río de Janeiro', lat: -22.91, lon: -43.17 },
  { name: 'Montevideo', lat: -34.9, lon: -56.16 },
  { name: 'Estados Unidos', lat: 39.8, lon: -98.6 },
  { name: 'México', lat: 23.6, lon: -102.5 },
  { name: 'Brasil', lat: -14.2, lon: -51.9 },
  { name: 'Argentina', lat: -38.4, lon: -63.6 },
  { name: 'Colombia', lat: 4.6, lon: -74.3 },
  { name: 'Chile', lat: -35.7, lon: -71.5 },
  { name: 'Canadá', lat: 56.1, lon: -106.3 },

  // Asia y Oceanía
  { name: 'Tokio', lat: 35.68, lon: 139.69 },
  { name: 'Osaka', lat: 34.69, lon: 135.5 },
  { name: 'Seúl', lat: 37.57, lon: 126.98 },
  { name: 'Pekín', lat: 39.9, lon: 116.41 },
  { name: 'Shanghái', lat: 31.23, lon: 121.47 },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17 },
  { name: 'Singapur', lat: 1.35, lon: 103.82 },
  { name: 'Bangkok', lat: 13.76, lon: 100.5 },
  { name: 'Yakarta', lat: -6.21, lon: 106.85 },
  { name: 'Bombay', lat: 19.08, lon: 72.88 },
  { name: 'Nueva Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Bangalore', lat: 12.97, lon: 77.59 },
  { name: 'Dubái', lat: 25.2, lon: 55.27 },
  { name: 'Tel Aviv', lat: 32.09, lon: 34.78 },
  { name: 'Sídney', lat: -33.87, lon: 151.21 },
  { name: 'Melbourne', lat: -37.81, lon: 144.96 },
  { name: 'Auckland', lat: -36.85, lon: 174.76 },
  { name: 'Japón', lat: 36.2, lon: 138.3 },
  { name: 'China', lat: 35.9, lon: 104.2 },
  { name: 'India', lat: 20.6, lon: 79.0 },
  { name: 'Australia', lat: -25.3, lon: 133.8 },

  // África
  { name: 'El Cairo', lat: 30.04, lon: 31.24 },
  { name: 'Lagos', lat: 6.52, lon: 3.38 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Johannesburgo', lat: -26.2, lon: 28.05 },
  { name: 'Ciudad del Cabo', lat: -33.92, lon: 18.42 },
  { name: 'Casablanca', lat: 33.57, lon: -7.59 },
  { name: 'Sudáfrica', lat: -30.6, lon: 22.9 },
  { name: 'Nigeria', lat: 9.1, lon: 8.7 },
  { name: 'Marruecos', lat: 31.8, lon: -7.1 },
  { name: 'Egipto', lat: 26.8, lon: 30.8 },
];

/** Sin acentos, sin mayúsculas y sin espacios de sobra. */
function normalize(value: string): string {
  // NFD separa la letra de su tilde; el rango ̀-ͯ son esas tildes sueltas.
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const BY_NAME = new Map(PLACES.map((place) => [normalize(place.name), place]));

/**
 * Busca un sitio por su nombre. Insensible a acentos y mayúsculas, porque nadie
 * escribe "Sídney" con tilde cuando va con prisa.
 */
export function findPlace(name: string): Place | undefined {
  return BY_NAME.get(normalize(name));
}

/** Cuántas etiquetas de la lista se reconocen. Para ofrecer el autorrelleno. */
export function countKnown(labels: string[]): number {
  return labels.reduce((total, label) => total + (findPlace(label) ? 1 : 0), 0);
}
