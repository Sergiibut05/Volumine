import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import { Comprar } from './Comprar';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { currentUser } from '@/lib/charts/queries';

export const metadata: Metadata = {
  title: 'Precios',
  description: 'Un pago y ya está. Sin marca de agua, para siempre.',
};

/*
  ══════════════════════════════════════════════════════════════════════════
  UNA OFERTA, NO UN COMPARADOR
  ══════════════════════════════════════════════════════════════════════════

  La versión anterior ponía las dos opciones en columnas iguales y dejaba
  elegir. Eso no es una página de precios, es un catálogo: presenta el plan
  gratuito como una alternativa legítima al de pago y el resultado previsible es
  que casi todo el mundo se queda en el gratuito.

  Aquí hay UNA oferta —el pago único— y el plan gratuito está debajo como lo que
  de verdad es: la forma de probar antes de decidir. Distinta jerarquía, distinto
  tamaño, distinto peso.

  ── SOBRE EL «PRECIO DE LANZAMIENTO» ─────────────────────────────────────

  Se dice que es de lanzamiento y NO se tacha ningún precio anterior. No es una
  sutileza de estilo: la Directiva Omnibus obliga a que cualquier descuento
  anunciado indique el precio más bajo de los treinta días anteriores. Nunca se
  ha vendido a 39 €, así que tachar 39 € sería publicidad engañosa.

  Decir «precio de lanzamiento» habla del futuro y no del pasado, así que es
  legítimo — con una condición: que sea verdad y el precio suba de verdad.

  ── LOS IMPORTES SALEN DE LA BASE ────────────────────────────────────────

  Se leen de `plan_limits`, la misma tabla de la que el checkout saca el
  `price_id` y el webhook deduce qué plan conceder. Escribirlos en el JSX
  garantizaría que un día la página anuncie un importe y la pasarela cobre otro.
*/

const dinero = (centimos: number, moneda: string) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: moneda.toUpperCase(),
    minimumFractionDigits: centimos % 100 === 0 ? 0 : 2,
  }).format(centimos / 100);

export default async function PreciosPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="studio" data-theme="light">
        <main className="shell legal">
          <h1>Precios</h1>
          <p>Esta instalación no tiene base de datos configurada.</p>
        </main>
      </div>
    );
  }

  const db = await supabaseServer();
  const [{ data: planes }, user] = await Promise.all([
    db
      .from('plan_limits')
      .select('plan, max_charts, watermark, stripe_price_id, price_cents, currency')
      .order('price_cents'),
    currentUser(),
  ]);

  const gratis = planes?.find((p) => p.plan === 'free');
  const pro = (planes ?? []).find((p) => p.stripe_price_id && p.price_cents > 0);

  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell precios">
        <h1 className="display">Un pago y ya está.</h1>
        <p className="precios-lead">
          Sin cuotas, sin renovaciones y sin que nadie te devuelva la marca de agua el día
          que dejes de pagar. Se compra una vez y es tuyo.
        </p>

        <div className="precios-cuerpo">
        {pro ? (
          <section className="oferta">
            <p className="oferta-etiqueta">Precio de lanzamiento</p>

            <p className="oferta-cifra">
              {dinero(pro.price_cents, pro.currency ?? 'eur')}
              <span>una sola vez</span>
            </p>
            {/* El IVA lo calcula la pasarela según el país de quien compra, así
                que aquí se dice — no se puede prometer un total. */}
            <p className="precio-iva">IVA aparte, según tu país</p>

            <ul className="oferta-lista">
              <li>
                <strong>Sin marca de agua</strong>, en todas tus gráficas y para siempre
              </li>
              <li>Hasta {pro.max_charts} gráficas guardadas</li>
              <li>Todos los tipos, todos los temas y todas las opciones</li>
              <li>Las gráficas que ya publicaste siguen funcionando pase lo que pase</li>
            </ul>

            <Comprar
              plan={pro.plan}
              haySesion={Boolean(user)}
              entrar="Entra para comprar"
              textoBoton="Comprar y pagar"
              textoCasilla="Quiero empezar a usarlo ya y entiendo que, al hacerlo, pierdo el derecho de desistimiento de 14 días."
            />

            <p className="oferta-nota">
              Es el precio de salida y subirá más adelante. Quien compre ahora lo conserva.
            </p>
          </section>
        ) : (
          <p className="precios-lead">
            Todavía no hay ningún plan de pago activo. El plan gratuito no caduca.
          </p>
        )}

        {/*
          El plan gratuito, DEBAJO y en pequeño. No es una alternativa que
          compita: es la forma de probar antes de decidir, y presentarlo como
          columna gemela de la de pago solo consigue que la gente se quede ahí.
        */}
        <section className="gratis">
          <h2>¿Prefieres probarlo antes?</h2>
          <p>
            El editor y el link funcionan sin cuenta ni pagar nada. Con cuenta gratuita
            guardas hasta {gratis?.max_charts ?? 5} gráficas; llevan una marca de agua
            discreta en la esquina.
          </p>
          <Link className="precio-cta precio-cta-suave" href="/crear">
            Abrir el editor
          </Link>
        </section>
        </div>

        <p className="precios-nota">
          Pago único, sin renovación automática y sin nada que cancelar. Las condiciones
          completas están en las <Link href="/legal/terminos">condiciones de uso</Link>.
        </p>
      </main>
    </div>
  );
}
