import type { Metadata } from 'next';
import { COOKIES, dato } from '@/lib/legal';

/*
  ── FUERA DEL ÍNDICE, Y CON DESCRIPCIÓN PROPIA ───────────────────────────

  `noindex` porque una página legal no compite por nada: nadie busca esto en
  Google, y estando indexada SÍ compite — con la marca. Buscando «volumine»,
  el aviso legal salía por delante de la portada, porque el aviso legal repite
  «Volumine» en cada párrafo y el titular de la portada no lo dice ni una vez.
  `follow` se queda: los enlaces del pie siguen valiendo.

  Sigue siendo accesible para cualquiera que entre, que es lo que exige la ley.
  Estar en el índice de Google no es un requisito legal en ninguna parte.

  Y descripción PROPIA. Las cuatro heredaban la de la portada —«Make a
  beautiful 3D chart…»—, o sea que le decían a Google que el aviso legal iba
  del producto. Era la mitad del problema.
*/
export const metadata: Metadata = {
  /* Sin «· Volumine»: la plantilla del layout ya lo añade, y escribirlo aquí
     producía «Cookies · Volumine · Volumine». */
  title: 'Cookies',
  description: 'Qué cookies usa Volumine y para qué. Son dos, las dos técnicas, y ninguna sirve para publicidad ni para analítica de terceros.',
  robots: { index: false, follow: true },
};

/*
  Política de cookies — artículo 22.2 de la LSSI.

  La lista sale de auditar el código, no de una plantilla: son las dos que se
  ponen de verdad, con su nombre real. Y las dos son técnicas, así que NO hace
  falta banner de consentimiento — la ley exime a las estrictamente necesarias
  para prestar un servicio pedido expresamente por quien lo usa.

  Ese «no hace falta banner» es consecuencia directa de no meter analítica. En
  cuanto entre una sola herramienta de medición, esta página deja de ser cierta
  y aparece la obligación del banner. Las dos cosas van juntas y conviene que se
  vea escrito aquí, porque la tentación de «añadir solo un pixel de analytics»
  llega siempre.
*/
export default function Cookies() {
  return (
    <article>
      <h1>Política de cookies</h1>

      <h2>Resumen</h2>
      <p>
        Este sitio usa <strong>dos cookies, las dos técnicas</strong>. No hay publicidad, ni
        perfilado, ni cookies de terceros. Por eso no verás un aviso pidiéndote permiso: la
        ley no lo exige para cookies estrictamente necesarias para prestar el servicio que
        has pedido.
      </p>
      <p>
        Sí se cuentan las visitas, con <strong>Vercel Web Analytics</strong>, y conviene
        decirlo con precisión: <strong>no usa cookies</strong> ni guarda nada en tu
        dispositivo. Cuenta de forma agregada, sin seguirte entre sitios ni construir un
        perfil. Como no escribe ni lee nada de tu equipo, no entra en lo que exige pedir
        permiso; como sí recibe tu dirección IP, aparece declarado en la{' '}
        <a href="/legal/privacidad">política de privacidad</a>.
      </p>

      <h2>Las gráficas incrustadas no ponen ninguna</h2>
      <p>
        La página del embed —la que se carga dentro de otra web— no instala cookies ni hace
        peticiones a terceros. Puedes incrustar una gráfica en un sitio con una política
        estricta sin que eso añada obligaciones nuevas.
      </p>

      <h2>Cuáles son</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Quién la pone</th>
            <th>Para qué</th>
            <th>Cuánto dura</th>
          </tr>
        </thead>
        <tbody>
          {COOKIES.map((c) => (
            <tr key={c.nombre}>
              <td>
                <code>{c.nombre}</code>
              </td>
              <td>{c.quien}</td>
              <td>{c.para}</td>
              <td>{c.duracion}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cómo quitarlas</h2>
      <p>
        Puedes borrarlas o bloquearlas desde la configuración de tu navegador. Si bloqueas
        la de sesión no podrás mantener la sesión iniciada, y si bloqueas la de idioma
        tendrás que elegirlo cada vez.
      </p>

      <h2>Dudas</h2>
      <p>
        Escribe a <strong>{dato('email')}</strong>.
      </p>
    </article>
  );
}
