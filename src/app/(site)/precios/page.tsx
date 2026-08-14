import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import { Comprar } from './Comprar';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { currentUser } from '@/lib/charts/queries';
import { getDictionary } from '@/lib/i18n/server';
import { fill } from '@/lib/i18n/dictionaries';
import { DatosEstructurados } from '../DatosEstructurados';

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();
  return { title: d.nav.pricing, description: d.pricing.lead };
}

/*
  ══════════════════════════════════════════════════════════════════════════
  UNA OFERTA, NO UN COMPARADOR
  ══════════════════════════════════════════════════════════════════════════

  La primera versión ponía las dos opciones en columnas iguales y dejaba elegir.
  Eso no es una página de precios, es un catálogo: presenta el plan gratuito
  como una alternativa legítima al de pago, y el resultado previsible es que
  casi todo el mundo se queda en el gratuito.

  Aquí hay UNA oferta y el plan gratuito la acompaña con otro peso: más
  estrecho, hundido en el papel y empezando a la altura del precio. Comparten
  fila sin competir.

  ── SOBRE EL «PRECIO DE LANZAMIENTO» ─────────────────────────────────────

  Se dice que es de lanzamiento y NO se tacha ningún precio anterior. No es una
  sutileza de estilo: la Directiva Omnibus obliga a que cualquier descuento
  anunciado indique el precio más bajo de los treinta días anteriores. Nunca se
  ha vendido más caro, así que tachar una cifra inventada sería publicidad
  engañosa. Hablar del futuro sí es legítimo, con la condición de que se cumpla.

  ── LOS IMPORTES SALEN DE LA BASE ────────────────────────────────────────

  Se leen de `plan_limits`, la misma tabla de la que el checkout saca el
  `price_id` y el webhook deduce qué plan conceder. Escribirlos en el JSX
  garantizaría que un día la página anuncie un importe y la pasarela cobre otro.
*/

const dinero = (centimos: number, moneda: string, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda.toUpperCase(),
    minimumFractionDigits: centimos % 100 === 0 ? 0 : 2,
  }).format(centimos / 100);

export default async function PreciosPage() {
  const { d, locale } = await getDictionary();

  if (!supabaseConfigured()) {
    return (
      <div className="studio" data-theme="light">
        <main className="shell legal">
          <h1>{d.nav.pricing}</h1>
          <p>{d.auth.noAccountsBody}</p>
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
  const intl = locale === 'es' ? 'es-ES' : 'en-GB';

  return (
    <div className="studio" data-theme="light">
      {/* Los datos estructurados CON el importe van aquí y no en la portada:
          el plan ya está cargado en esta página —se usa para pintar la cifra—,
          así que no cuesta ninguna consulta extra, y una oferta declarada en la
          página donde se compra es lo que espera un buscador. */}
      <DatosEstructurados
        descripcion={d.pricing.lead}
        precioCentimos={pro?.price_cents ?? null}
        moneda={pro?.currency ?? null}
      />

      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell precios">
        <h1 className="display">{d.pricing.title}</h1>
        <p className="precios-lead">{d.pricing.lead}</p>

        <div className="precios-cuerpo">
          {pro ? (
            <section className="oferta">
              <p className="oferta-etiqueta">{d.pricing.launchTag}</p>

              <p className="oferta-cifra">
                {dinero(pro.price_cents, pro.currency ?? 'eur', intl)}
                <span>{d.pricing.once}</span>
              </p>
              {/* El IVA lo calcula la pasarela según el país de quien compra,
                  así que aquí se dice — no se puede prometer un total. */}
              <p className="precio-iva">{d.pricing.vat}</p>

              <ul className="oferta-lista">
                <li>
                  <strong>{d.pricing.f1a}</strong>
                  {d.pricing.f1b}
                </li>
                <li>{fill(d.pricing.f2, { n: pro.max_charts })}</li>
                <li>{d.pricing.f3}</li>
                <li>{d.pricing.f4}</li>
              </ul>

              <Comprar
                plan={pro.plan}
                haySesion={Boolean(user)}
                entrar={d.pricing.signInToBuy}
                textoBoton={d.pricing.buy}
                textoAviso={d.pricing.notice}
              />

              <p className="oferta-nota">{d.pricing.willRise}</p>
            </section>
          ) : (
            <p className="precios-lead">{d.pricing.none}</p>
          )}

          {/*
            El plan gratuito, al lado pero sin competir. No es una alternativa:
            es la forma de probar antes de decidir, y presentarlo como columna
            gemela de la de pago solo consigue que la gente se quede ahí.
          */}
          <section className="gratis">
            <h2>{d.pricing.freeTitle}</h2>
            <p>{fill(d.pricing.freeBody, { n: gratis?.max_charts ?? 5 })}</p>
            <Link className="precio-cta precio-cta-suave" href="/crear">
              {d.pricing.openEditor}
            </Link>
          </section>
        </div>

        <p className="precios-nota">
          {d.pricing.foot} <Link href="/legal/terminos">{d.pricing.footLink}</Link>.
        </p>
      </main>
    </div>
  );
}
