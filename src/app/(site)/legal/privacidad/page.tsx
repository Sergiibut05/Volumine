import type { Metadata } from 'next';
import { dato, ENCARGADOS } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacidad · Volumine' };

/*
  Política de privacidad — artículos 13 y 14 del RGPD.

  Está escrita contra LO QUE EL CÓDIGO HACE DE VERDAD, no contra una plantilla:
  las categorías de datos salen del esquema de la base (`supabase/migrations`),
  los encargados de `src/lib/legal.ts`, y lo que se dice del embed sale de la
  regla dura número 1 del proyecto. Si alguna de esas tres cosas cambia, este
  texto queda desactualizado Y hay que tocarlo — no es documentación decorativa.
*/
export default function Privacidad() {
  return (
    <article>
      <h1>Política de privacidad</h1>

      <h2>Quién trata tus datos</h2>
      <p>
        El responsable es {dato('nombre')}, con NIF {dato('nif')} y domicilio en{' '}
        {dato('domicilio')}. Puedes escribir a <strong>{dato('email')}</strong> para
        cualquier cosa relacionada con tus datos.
      </p>

      <h2>Qué datos se tratan y para qué</h2>
      <table>
        <thead>
          <tr>
            <th>Datos</th>
            <th>Para qué</th>
            <th>Base jurídica</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Correo electrónico y nombre visible</td>
            <td>Crear la cuenta, iniciar sesión y asociarte tus gráficas</td>
            <td>Ejecución del contrato (art. 6.1.b)</td>
          </tr>
          <tr>
            <td>Las gráficas que guardas: sus datos, su configuración y su imagen</td>
            <td>Guardarlas, mostrártelas y publicarlas si tú lo pides</td>
            <td>Ejecución del contrato (art. 6.1.b)</td>
          </tr>
          <tr>
            <td>Registros técnicos del servidor y direcciones IP</td>
            <td>Mantener el servicio en pie y prevenir abusos</td>
            <td>Interés legítimo en la seguridad (art. 6.1.f)</td>
          </tr>
          <tr>
            <td>Visitas a las páginas, de forma agregada y sin cookies</td>
            <td>Saber qué se usa y qué no, para decidir qué mejorar</td>
            <td>Interés legítimo (art. 6.1.f)</td>
          </tr>
          <tr>
            <td>Datos de facturación, cuando existan planes de pago</td>
            <td>Cobrar y emitir la factura</td>
            <td>Contrato y obligación legal (arts. 6.1.b y 6.1.c)</td>
          </tr>
        </tbody>
      </table>

      <h2>Lo que NO se hace</h2>
      <p>
        No hay publicidad, ni perfilado, ni decisiones automatizadas, ni venta o cesión de
        datos a terceros con fines comerciales.
      </p>
      <p>
        <strong>Las gráficas incrustadas no rastrean a quien las ve.</strong> La página del
        embed no instala cookies, no llama a servidores de terceros y no recoge datos de las
        personas que visitan la web donde esté puesta. Es una restricción del propio diseño
        del producto, no una promesa: si dejara de cumplirse habría que reescribir este
        párrafo y avisar.
      </p>

      <h2>Quién más ve tus datos</h2>
      <p>
        Solo los proveedores necesarios para prestar el servicio, todos con contrato de
        encargado de tratamiento:
      </p>
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Para qué</th>
            <th>Dónde</th>
          </tr>
        </thead>
        <tbody>
          {ENCARGADOS.map((e) => (
            <tr key={e.nombre}>
              <td>
                <a href={e.dpa} target="_blank" rel="noreferrer">
                  {e.nombre}
                </a>
              </td>
              <td>{e.para}</td>
              <td>{e.donde}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Cuando un proveedor trata datos fuera del Espacio Económico Europeo, lo hace
        amparado en cláusulas contractuales tipo aprobadas por la Comisión Europea.
      </p>

      <h2>Si publicas una gráfica</h2>
      <p>
        Una gráfica publicada es accesible para cualquiera que tenga su enlace, y eso
        incluye los datos que hayas puesto en ella. No publiques gráficas con información
        personal o confidencial que no quieras que se vea. Puedes despublicarla en cualquier
        momento; a partir de ese momento el enlace deja de funcionar, aunque quien ya la
        hubiera copiado conserva su copia.
      </p>

      <h2>Cuánto se conservan</h2>
      <p>
        Mientras tengas la cuenta abierta. Si la borras, se eliminan tus gráficas y tu
        perfil. Los datos de facturación se conservan los plazos que exige la normativa
        mercantil y fiscal, y los registros técnicos, un periodo breve por seguridad.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir acceso a tus datos, su rectificación o su supresión, la limitación u
        oposición al tratamiento, y su portabilidad. Basta con escribir a{' '}
        <strong>{dato('email')}</strong>. Si crees que no se han atendido como debían,
        puedes reclamar ante la{' '}
        <a href="https://www.aepd.es" target="_blank" rel="noreferrer">
          Agencia Española de Protección de Datos
        </a>
        .
      </p>

      <h2>Edad mínima</h2>
      <p>
        El servicio no está dirigido a menores de catorce años, que es la edad a partir de
        la cual pueden consentir por sí mismos según la normativa española.
      </p>

      <h2>Cookies</h2>
      <p>
        Solo se usan cookies técnicas. El detalle está en la{' '}
        <a href="/legal/cookies">política de cookies</a>.
      </p>

      <h2>Cambios</h2>
      <p>
        Si esta política cambia de forma relevante, se avisará en el propio sitio y, si
        tienes cuenta, por correo. La fecha de la última revisión está al pie.
      </p>
    </article>
  );
}
