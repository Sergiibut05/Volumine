import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import { cafeEnabled } from '@/lib/billing/config';
import { importe } from '@/lib/cafe';
import { getDictionary } from '@/lib/i18n/server';
import { fill } from '@/lib/i18n/dictionaries';
import { DatosEstructurados } from '../DatosEstructurados';
import { Taza } from './Taza';
import { Invitar } from './Invitar';

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();
  return { title: d.nav.coffee, description: d.coffee.lead };
}

/*
  ══════════════════════════════════════════════════════════════════════════
  INVÍTAME A UN CAFÉ — LO QUE QUEDÓ DE LA PÁGINA DE PRECIOS
  ══════════════════════════════════════════════════════════════════════════

  Aquí hubo un plan Pro de pago único. Se quitó (ADR 0008): todo es gratis y lo
  único que se pide es una invitación voluntaria, al estilo Buy Me a Coffee.

  La página tiene que dejar claras DOS cosas en el primer golpe de vista, y en
  este orden: que no hay nada bloqueado, y que si quieres ayudar es un botón.
  Por eso el titular dice «gratis» antes de pedir nada, y la tarjeta repite
  debajo del botón que no desbloquea nada — quien venía buscando un plan de
  pago tiene que entender que no lo necesita.

  `?gracias=1` y `?error=1` los pone la ruta del checkout al volver. Ninguno
  concede nada: solo cambian el mensaje.
*/

export default async function CafePage({
  searchParams,
}: {
  searchParams: Promise<{ gracias?: string; error?: string }>;
}) {
  const [{ d, locale }, params] = await Promise.all([getDictionary(), searchParams]);
  const activo = cafeEnabled();
  const gracias = params.gracias === '1';
  const error = params.error === '1';

  return (
    <div className="studio" data-theme="light">
      <DatosEstructurados descripcion={d.meta.siteDescription} />

      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell cafe">
        <div className="cafe-cabeza">
          <p className="cafe-etiqueta">{d.coffee.tag}</p>
          <h1 className="display">{d.coffee.title}</h1>
          <p className="cafe-lead">{d.coffee.lead}</p>
        </div>

        <div className="cafe-cuerpo">
          <section className="cafe-tarjeta" aria-labelledby="cafe-pedir">
            <Taza />

            {gracias && (
              <div className="cafe-gracias" role="status">
                <h2>{d.coffee.thanksTitle}</h2>
                <p>{d.coffee.thanksBody}</p>
              </div>
            )}

            {error && (
              <p className="auth-error" role="alert">
                {d.coffee.error}
              </p>
            )}

            {activo ? (
              <Invitar
                locale={locale}
                textos={{
                  pick: d.coffee.pick,
                  unitOne: d.coffee.unitOne,
                  unitMany: d.coffee.unitMany,
                  each: fill(d.coffee.each, {
                    price: importe(1, locale),
                  }),
                  button: d.coffee.button,
                }}
              />
            ) : (
              <p className="cafe-apagado" id="cafe-pedir">
                {d.coffee.off}
              </p>
            )}

            {activo && (
              <>
                <p className="cafe-nota">{d.coffee.note}</p>
                <p className="cafe-nota">{d.coffee.noUnlock}</p>
              </>
            )}
          </section>

          <aside className="cafe-lado">
            <section>
              <h2>{d.coffee.whereTitle}</h2>
              <ul className="cafe-destinos">
                <li>{d.coffee.where1}</li>
                <li>{d.coffee.where2}</li>
                <li>{d.coffee.where3}</li>
              </ul>
            </section>

            <section className="cafe-sin">
              <h2>{d.coffee.otherTitle}</h2>
              <p>{d.coffee.otherBody}</p>
              <Link className="cafe-enlace" href="/crear">
                {d.nav.openEditor} →
              </Link>
            </section>
          </aside>
        </div>

        <p className="precios-nota">
          {d.coffee.foot} <Link href="/legal/terminos">{d.coffee.footLink}</Link>.
        </p>
      </main>
    </div>
  );
}
