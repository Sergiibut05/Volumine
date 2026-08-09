import type { Metadata } from 'next';
import '@/styles/auth.css';
import { ClaveNueva } from './ClaveNueva';
import { getDictionary } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();
  return {
    title: d.auth.newPasswordTitle,
    // Una pantalla de acceso no pinta nada en un buscador.
    robots: { index: false, follow: false },
  };
}

/*
  Donde aterriza el enlace de «he olvidado la contraseña».

  Todo el trabajo es de cliente y tiene que serlo: el token de recuperación viaja
  en el FRAGMENTO de la URL —lo que va detrás de `#`—, y el fragmento no se envía
  nunca al servidor. Un componente de servidor aquí no vería nada.
*/
export default function NuevaClavePage() {
  return (
    <div className="studio auth-page" data-theme="light">
      <ClaveNueva />
    </div>
  );
}
