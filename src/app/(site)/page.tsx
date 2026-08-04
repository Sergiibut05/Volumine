/*
  Marcador de posición. La landing de verdad es la Fase 7 del roadmap y va a
  nivel Awwwards (docs/DESIGN.md): hero con una gráfica Voluma real renderizada
  en vivo, con el mismo renderer que usan los clientes.

  Mientras tanto esto solo existe para que la ruta resuelva.
*/

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeContent: 'center',
        gap: 'var(--p-space-4)',
        padding: 'var(--p-space-8)',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          font: `600 var(--p-text-3xl)/var(--p-leading-tight) var(--font-display)`,
          margin: 0,
          letterSpacing: '-0.02em',
        }}
      >
        Voluma
      </h1>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
        Gráficas 3D que se incrustan en cualquier sitio con un link.
      </p>
      <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 'var(--p-text-sm)' }}>
        En construcción · <a href="/dev/renderer">banco del renderer</a>
      </p>
    </main>
  );
}
