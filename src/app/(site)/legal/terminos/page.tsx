import type { Metadata } from 'next';
import { dato } from '@/lib/legal';

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
     producía «Condiciones de uso · Volumine · Volumine». */
  title: 'Condiciones de uso',
  description:
    'Condiciones de uso de Volumine: qué es el servicio, de quién es lo que creas, qué pasa con las gráficas publicadas y cómo funcionan las invitaciones voluntarias.',
  robots: { index: false, follow: true },
};

/*
  Condiciones de uso.

  Ninguna ley obliga a tenerlas con este nombre, pero sin ellas no hay contrato
  escrito: no está dicho qué se puede hacer con el servicio, de quién es lo que
  sube cada persona, ni qué pasa cuando algo se cae. Y en cuanto haya planes de
  pago pasan a ser obligatorias de verdad, porque entran las normas de
  contratación a distancia y de consumo.

  El servicio es gratuito y no hay plan de pago (ADR 0008). Lo único que se
  cobra es la invitación voluntaria de `/cafe`, que NO es una compra: no da
  acceso a nada que no tuvieras ya. Por eso aquí no hay desistimiento de
  contenido digital que regular; sí se dice qué es y que no compra nada, para
  que nadie pague creyendo que se lleva algo.

  Si algún día vuelve un plan de pago, este archivo hay que repasarlo entero, y
  muy en particular el derecho de desistimiento, que en contenido digital tiene
  una excepción con requisitos concretos que se implementa EN LA PASARELA.
*/
export default function Terminos() {
  return (
    <article>
      <h1>Condiciones de uso</h1>

      <p>
        Estas condiciones regulan el uso de Volumine. Usar el servicio implica aceptarlas.
        El titular es {dato('nombre')}, y puedes escribir a <strong>{dato('email')}</strong>
        .
      </p>

      <h2>Qué es el servicio</h2>
      <p>
        Volumine permite crear gráficas tridimensionales, guardarlas y publicarlas mediante
        un enlace incrustable en otras páginas. Puede usarse sin cuenta; para guardar y
        publicar hace falta una.
      </p>

      <h2>Tu cuenta</h2>
      <p>
        Los datos que facilites deben ser ciertos, y eres responsable de lo que se haga
        desde tu cuenta. Puedes cerrarla cuando quieras: al hacerlo se borran tus gráficas y
        tus enlaces publicados dejan de funcionar.
      </p>

      <h2>De quién es lo que creas</h2>
      <p>
        <strong>Tuyo.</strong> Los datos que introduces y las gráficas que construyes siguen
        siendo tuyos. Para poder prestarte el servicio nos concedes la licencia
        estrictamente necesaria para alojarlos, procesarlos y mostrarlos: si publicas una
        gráfica, para servirla a quien abra su enlace; si no la publicas, solo para
        guardártela y enseñártela a ti.
      </p>
      <p>
        Esa licencia dura lo que dure el servicio sobre ese contenido y se acaba cuando lo
        borras. No se usa tu contenido para promocionar el producto sin pedírtelo antes.
      </p>

      <h2>Qué no se puede hacer</h2>
      <ul>
        <li>
          Publicar contenido ilícito, que infrinja derechos de terceros o que incluya datos
          personales de otras personas sin su consentimiento.
        </li>
        <li>
          Intentar tumbar el servicio, saltarse los límites de uso o acceder a datos que no
          son tuyos.
        </li>
        <li>Usar el servicio de una forma que impida que funcione para los demás.</li>
      </ul>
      <p>
        Ante un incumplimiento claro se puede suspender o cerrar la cuenta, avisándote salvo
        que hacerlo agrave el problema.
      </p>

      <h2>Disponibilidad</h2>
      <p>
        El servicio se ofrece «tal cual». Se procura que esté siempre disponible, pero no se
        garantiza ni la continuidad ni la ausencia de errores, y puede haber paradas por
        mantenimiento. Guarda una copia de los datos que te importen: la herramienta no
        sustituye a tu propio archivo.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        El titular responde de los daños causados por incumplir estas condiciones en los
        términos previstos por la ley. Nada de lo aquí escrito excluye la responsabilidad
        que no puede excluirse legalmente, en particular frente a personas consumidoras.
      </p>

      <h2>Precio</h2>
      <p>
        El servicio es gratuito y no tiene planes de pago. Si en el futuro se añadiera
        alguno, sus precios, impuestos y condiciones se mostrarán antes de contratar, y lo
        que ya estuviera publicado seguirá funcionando: el compromiso es que activar un
        cobro no rompa un enlace que ya existía.
      </p>

      <h2>Invitaciones voluntarias («invítame a un café»)</h2>
      <p>
        Desde la página <a href="/cafe">Invítame a un café</a> puedes hacer un pago
        voluntario y puntual para apoyar el proyecto. Es una aportación, no una compra:{' '}
        <strong>
          no desbloquea funciones, no crea una suscripción y no da derecho a ningún servicio
          adicional
        </strong>
        , porque todo el servicio es ya gratuito para todo el mundo.
      </p>
      <p>
        El pago lo procesa Stripe, que es quien recoge los datos de la tarjeta; aquí no
        llegan nunca. El importe se muestra antes de pagar y no se cobra nada más. Si
        hiciste una invitación por error, escribe a <strong>{dato('email')}</strong> en los
        catorce días siguientes y se devolverá.
      </p>

      <h2>Cambios en estas condiciones</h2>
      <p>
        Pueden cambiar. Si el cambio es relevante se avisará en el sitio y, si tienes
        cuenta, por correo, con antelación suficiente para que puedas cerrarla si no estás
        de acuerdo.
      </p>

      <h2>Ley y resolución de conflictos</h2>
      <p>
        Se aplica la legislación española. Si eres una persona consumidora, conservas el
        derecho a acudir a los tribunales de tu domicilio y puedes usar la plataforma de{' '}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
          resolución de litigios en línea
        </a>{' '}
        de la Comisión Europea.
      </p>
    </article>
  );
}
