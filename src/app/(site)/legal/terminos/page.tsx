import type { Metadata } from 'next';
import { dato } from '@/lib/legal';

export const metadata: Metadata = { title: 'Condiciones de uso · Volumine' };

/*
  Condiciones de uso.

  Ninguna ley obliga a tenerlas con este nombre, pero sin ellas no hay contrato
  escrito: no está dicho qué se puede hacer con el servicio, de quién es lo que
  sube cada persona, ni qué pasa cuando algo se cae. Y en cuanto haya planes de
  pago pasan a ser obligatorias de verdad, porque entran las normas de
  contratación a distancia y de consumo.

  El apartado de pagos está escrito EN FUTURO a propósito: hoy no se cobra. En
  cuanto se cobre hay que repasarlo entero, y muy en particular el derecho de
  desistimiento, que en contenido digital tiene una excepción con requisitos
  concretos —hay que recabar el consentimiento previo y expreso a empezar antes
  de los catorce días— que se implementa EN LA PASARELA, no aquí.
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
        Hoy el servicio es gratuito. Si en el futuro se añaden planes de pago, sus precios,
        impuestos y condiciones se mostrarán antes de contratar, y lo que ya estuviera
        publicado seguirá funcionando: el compromiso es que activar el cobro no rompa un
        enlace que ya existía.
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
