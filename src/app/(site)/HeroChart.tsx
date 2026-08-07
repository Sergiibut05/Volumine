'use client';

import { useMemo, useState } from 'react';
import { useOrigin } from '@/lib/use-origin';
import { ChartCanvas } from '@/renderer/ChartCanvas';
import { parseConfig } from '@/lib/config/parse';
import { buildEmbedUrl } from '@/lib/config/url';
import { THEMES } from '@/lib/themes';
import { useI18n } from '@/lib/i18n/client';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { samplesFor } from '@/lib/i18n/samples';
import type { ChartConfig } from '@/lib/config/schema';

/*
  El héroe de la landing.

  La firma de la página es la TIRA DE URL: el producto es el link, así que el
  link se muestra cambiando en vivo mientras tocas la gráfica. Ningún generador
  de gráficas puede enseñar eso, porque para ellos el link no es el producto.
*/

/* Las etiquetas del héroe son copia de la landing, no datos de nadie: van en
   el idioma de quien mira, como el resto de la página (ver lib/i18n/samples). */
const base = (locale: Locale): ChartConfig => {
  const { labels, unit, numberLocale } = samplesFor(locale).initial;

  return {
    v: 1,
    type: 'donut',
    data: {
      labels: labels.slice(0, 4),
      series: [{ values: [46, 27, 18, 9] }],
      format: { unit, locale: numberLocale },
    },
    scene: { background: { kind: 'transparent' } },
    layout: { watermark: false },
  };
};

export function HeroChart() {
  const { d, locale } = useI18n();
  const [themeId, setThemeId] = useState('aurora');
  const [copied, setCopied] = useState(false);
  const origin = useOrigin();

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  const config = useMemo<ChartConfig>(
    () => ({
      ...base(locale),
      theme: theme.id,
      style: { ...theme.config.style },
      scene: { ...theme.config.scene, background: { kind: 'transparent' } },
    }),
    [theme, locale],
  );

  const parsed = useMemo(() => parseConfig(config), [config]);
  const url = useMemo(
    () => (origin ? buildEmbedUrl(config, origin) : null),
    [config, origin],
  );

  const copy = async () => {
    if (!url?.ok) return;
    await navigator.clipboard.writeText(url.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className="stagebox">{parsed.ok && <ChartCanvas config={parsed.config} />}</div>

      <div style={{ display: 'grid', gap: '0.875rem', marginTop: '1.25rem' }}>
        <div
          role="group"
          aria-label={d.common.chartTheme}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
        >
          {THEMES.slice(0, 5).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setThemeId(t.id)}
              aria-pressed={t.id === themeId}
              title={d.themes[t.id as keyof Dictionary['themes']].use}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4375rem',
                padding: '0.375rem 0.6875rem 0.375rem 0.4375rem',
                borderRadius: 999,
                border: 0,
                cursor: 'pointer',
                font: 'inherit',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: t.id === themeId ? '#fff' : 'transparent',
                color: t.id === themeId ? 'var(--ink)' : 'var(--ink-soft)',
                boxShadow:
                  t.id === themeId
                    ? '0 1px 2px rgb(20 20 26 / .08), 0 6px 16px -8px rgb(20 20 26 / .3)'
                    : 'none',
                transition: 'background var(--p-dur-2) var(--p-ease-out)',
              }}
            >
              <span style={{ display: 'flex' }} aria-hidden>
                {t.swatch.slice(0, 4).map((c, i) => (
                  <i
                    key={c}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: c,
                      marginLeft: i === 0 ? 0 : -3,
                      boxShadow: '0 0 0 1.5px #fff',
                    }}
                  />
                ))}
              </span>
              {d.themes[t.id as keyof Dictionary['themes']].name}
            </button>
          ))}
        </div>

        {url?.ok && (
          <div className="urlstrip">
            <span className="spec-label">{d.landing.yourLink}</span>
            <code className="mono">
              {origin.replace(/^https?:\/\//, '')}/embed?c=<b>{urlTail(url.url)}</b>
            </code>
            <button className="copy" type="button" onClick={copy}>
              {copied ? d.common.copied : d.common.copy}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Últimos caracteres de la config, que son los que cambian al tocar el tema. */
function urlTail(url: string): string {
  const config = url.split('?c=')[1] ?? '';
  return config.length > 34 ? `…${config.slice(-34)}` : config;
}
