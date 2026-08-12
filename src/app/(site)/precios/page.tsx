import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import { Comprar } from './Comprar';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { currentUser } from '@/lib/charts/queries';

export const metadata: Metadata = {
  title: 'Precios',
  description: 'Gratis para empezar. Sin marca de agua cuando lo necesites.',
};

/*
  La página de precios.

  ── LOS PRECIOS SALEN DE LA BASE, NO DE AQUÍ ─────────────────────────────

  Se leen de `plan_limits`, la misma tabla de la que el checkout saca el
  `price_id` y el webhook deduce qué plan conceder. Escribirlos en el JSX
  garantizaría que un día la página anuncie un importe y la pasarela cobre otro,
  que además de quedar fatal es publicidad engañosa.

  Un plan sin `stripe_price_id` no sale: es un plan que existe en el esquema pero
  todavía no está a la venta.
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
  const dePago = (planes ?? []).filter((p) => p.stripe_price_id && p.price_cents > 0);

  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell precios">
        <h1 className="display">Gratis para empezar.</h1>
        <p className="precios-lead">
          El editor y el link funcionan sin cuenta. Pagar sirve para quitar la marca de agua
          y guardar más gráficas.
        </p>

        <div className="precios-rejilla">
          <article className="precio">
            <h2>Gratis</h2>
            <p className="precio-cifra">0 €</p>
            <ul>
              <li>Hasta {gratis?.max_charts ?? 20} gráficas guardadas</li>
              <li>Todos los tipos y todos los temas</li>
              <li>Con marca de agua</li>
            </ul>
            <Link className="precio-cta precio-cta-suave" href="/crear">
              Abrir el editor
            </Link>
          </article>

          {dePago.map((p) => (
            <article className="precio precio-destacado" key={p.plan}>
              <h2>{p.plan === 'pro' ? 'Pro' : p.plan}</h2>
              <p className="precio-cifra">
                {dinero(p.price_cents, p.currency ?? 'eur')}
                <span>/mes</span>
              </p>
              {/* El IVA se calcula en la pasarela según el país de quien compra,
                  así que aquí se dice — no se puede prometer un total. */}
              <p className="precio-iva">IVA aparte, según tu país</p>
              <ul>
                <li>Hasta {p.max_charts} gráficas guardadas</li>
                <li>
                  <strong>Sin marca de agua</strong>
                </li>
                <li>Cancelas cuando quieras, desde tu cuenta</li>
              </ul>
              <Comprar
                plan={p.plan}
                haySesion={Boolean(user)}
                entrar="Entra para suscribirte"
                textoBoton="Suscribirse y pagar"
                textoCasilla="Quiero empezar a usarlo ya y entiendo que, al hacerlo, pierdo el derecho de desistimiento de 14 días."
              />
            </article>
          ))}
        </div>

        {dePago.length === 0 && (
          <p className="precios-lead">
            Todavía no hay planes de pago activos. El plan gratuito no caduca.
          </p>
        )}

        <p className="precios-nota">
          Los precios se renuevan cada mes hasta que canceles. Puedes darte de baja en un
          clic desde tu cuenta, y las condiciones completas están en las{' '}
          <Link href="/legal/terminos">condiciones de uso</Link>.
        </p>
      </main>
    </div>
  );
}
