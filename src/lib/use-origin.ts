'use client';

import { useSyncExternalStore } from 'react';

/*
  El origen de la página, para construir los links de embed.

  Solo se conoce en el cliente, y leerlo con `useState` + `useEffect` provoca un
  render en cascada: el primero pinta sin origen y el efecto fuerza otro. Es lo
  que marca `react-hooks/set-state-in-effect`, y con razón.

  `useSyncExternalStore` es la API que React ofrece justo para esto: da un valor
  distinto en servidor y en cliente sin desajustar la hidratación y sin el render
  de más. El origen no cambia mientras la página vive, así que no hay nada a lo
  que suscribirse.
*/

const never = () => () => {};
const onClient = () => window.location.origin;
const onServer = () => '';

export function useOrigin(): string {
  return useSyncExternalStore(never, onClient, onServer);
}
