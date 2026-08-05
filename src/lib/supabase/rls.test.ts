import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/*
  ╔════════════════════════════════════════════════════════════════════════════╗
  ║  Tests de las políticas RLS                                                ║
  ╚════════════════════════════════════════════════════════════════════════════╝

  La ADR 0003 los pide explícitamente, y con razón: un fallo en una política de
  aquí no da error ni rompe nada visible. Simplemente enseña gráficas privadas
  a quien no debe, en silencio, hasta que alguien se da cuenta.

  Por eso NO se prueba el código de la aplicación: se prueba POSTGRES. Cada
  caso abre un cliente con la clave anónima —la misma que lleva el navegador— y
  comprueba qué deja pasar la base de datos. Que `queries.ts` haga bien su
  trabajo es irrelevante aquí; lo que se está comprobando es que aunque hiciera
  mal el suyo, los datos siguieran a salvo.

  ── PARA EJECUTARLOS ────────────────────────────────────────────────────────

    SUPABASE_TEST_URL=https://xxx.supabase.co \
    SUPABASE_TEST_ANON_KEY=... \
    SUPABASE_TEST_SERVICE_ROLE_KEY=... \
    npm run test

  Sin esas variables se saltan solos, para que `npm run test` siga funcionando
  en un clon recién bajado.

  Úsalos contra un proyecto de PRUEBAS o una rama de Supabase, nunca contra
  producción: crean y borran usuarios.

  La `service_role` se usa SOLO para dar de alta y limpiar los usuarios de
  prueba, que es lo único que la clave anónima no puede hacer. Ninguna
  comprobación se hace con ella: se salta RLS entera y daría todo por bueno.
*/

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const configured = Boolean(url && anonKey && serviceKey);
const suite = configured ? describe : describe.skip;

/** Config mínima válida. El contenido da igual: lo que se prueba es el acceso. */
const CONFIG = {
  v: 1,
  type: 'donut',
  data: { labels: ['A', 'B'], series: [{ values: [1, 2] }] },
};

type Actor = { client: SupabaseClient; id: string; email: string };

suite('políticas RLS', () => {
  let admin: SupabaseClient;
  /** Ana tiene gráficas. Bruno es otra persona. Nadie es un visitante sin cuenta. */
  let ana: Actor;
  let bruno: Actor;
  let nadie: SupabaseClient;

  let publica: string;
  let privada: string;

  /** Da de alta un usuario y devuelve un cliente con SU sesión. */
  async function crearActor(nombre: string): Promise<Actor> {
    const email = `rls-${nombre}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
    const password = `pw-${Math.random().toString(36).slice(2)}-A1!`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;

    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: loginError } = await client.auth.signInWithPassword({ email, password });
    if (loginError) throw loginError;

    return { client, id: data.user!.id, email };
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    ana = await crearActor('ana');
    bruno = await crearActor('bruno');
    nadie = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await ana.client
      .from('charts')
      .insert([
        {
          owner_id: ana.id,
          title: 'Pública',
          type: 'donut',
          config: CONFIG,
          visibility: 'public',
        },
        {
          owner_id: ana.id,
          title: 'Privada',
          type: 'donut',
          config: CONFIG,
          visibility: 'private',
        },
      ])
      .select('id, visibility');

    if (error) throw error;
    publica = data!.find((r) => r.visibility === 'public')!.id;
    privada = data!.find((r) => r.visibility === 'private')!.id;
  }, 30_000);

  afterAll(async () => {
    // `admin` se salta RLS, así que esto se lleva por delante también las
    // gráficas, por la clave foránea con `on delete cascade`.
    if (ana) await admin.auth.admin.deleteUser(ana.id);
    if (bruno) await admin.auth.admin.deleteUser(bruno.id);
  }, 30_000);

  // ── lo que hace posible el embed anónimo ──────────────────────────────────

  describe('un visitante sin cuenta', () => {
    it('ve una gráfica pública', async () => {
      const { data } = await nadie.from('charts').select('id').eq('id', publica);
      expect(data).toHaveLength(1);
    });

    /* SI ESTE TEST SE PONE ROJO, HAY UNA FUGA DE DATOS. Es el único de todo el
       repositorio del que se puede decir eso. */
    it('NO ve una privada, ni pidiéndola por su id', async () => {
      const { data, error } = await nadie.from('charts').select('id').eq('id', privada);
      /* Ojo con lo que se comprueba: RLS no da error de permisos, devuelve CERO
         filas. Un test que solo mirara `error` pasaría con la fuga abierta. */
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('no puede crear nada', async () => {
      const { error } = await nadie
        .from('charts')
        .insert({ owner_id: ana.id, type: 'donut', config: CONFIG });
      expect(error).not.toBeNull();
    });

    it('no puede borrar una gráfica pública que está viendo', async () => {
      await nadie.from('charts').delete().eq('id', publica);
      const { data } = await ana.client.from('charts').select('id').eq('id', publica);
      expect(data).toHaveLength(1);
    });
  });

  // ── entre usuarios ────────────────────────────────────────────────────────

  describe('otra persona con cuenta', () => {
    it('no ve la privada de Ana', async () => {
      const { data } = await bruno.client.from('charts').select('id').eq('id', privada);
      expect(data).toEqual([]);
    });

    it('no puede editarla', async () => {
      await bruno.client.from('charts').update({ title: 'Mía ahora' }).eq('id', privada);
      const { data } = await ana.client
        .from('charts')
        .select('title')
        .eq('id', privada)
        .single();
      expect(data!.title).toBe('Privada');
    });

    it('no puede borrarla', async () => {
      await bruno.client.from('charts').delete().eq('id', privada);
      const { data } = await ana.client.from('charts').select('id').eq('id', privada);
      expect(data).toHaveLength(1);
    });

    /* Ver una pública NO da derecho a tocarla. La política de select y la de
       update son distintas justo por esto. */
    it('no puede editar la pública de Ana aunque la vea', async () => {
      await bruno.client.from('charts').update({ title: 'Secuestrada' }).eq('id', publica);
      const { data } = await ana.client
        .from('charts')
        .select('title')
        .eq('id', publica)
        .single();
      expect(data!.title).toBe('Pública');
    });

    it('no puede crear una gráfica a nombre de Ana', async () => {
      const { error } = await bruno.client
        .from('charts')
        .insert({ owner_id: ana.id, type: 'donut', config: CONFIG });
      // `with check (auth.uid() = owner_id)` en la política de insert.
      expect(error).not.toBeNull();
    });

    /* Sin `with check` en la política de UPDATE, esto pasaría: se le puede
       REGALAR una gráfica a otro, o quitársela. `using` mira la fila de antes,
       `with check` la de después, y hacen falta las dos. */
    it('Ana no puede cambiarle el dueño a una gráfica suya', async () => {
      const { error } = await ana.client
        .from('charts')
        .update({ owner_id: bruno.id })
        .eq('id', privada);
      expect(error).not.toBeNull();
    });
  });

  // ── perfiles y plan ───────────────────────────────────────────────────────

  describe('perfiles', () => {
    it('se crea uno solo al registrarse, en plan gratis', async () => {
      const { data } = await ana.client
        .from('profiles')
        .select('plan')
        .eq('id', ana.id)
        .single();
      expect(data!.plan).toBe('free');
    });

    it('no se ve el perfil de otra persona', async () => {
      const { data } = await bruno.client.from('profiles').select('id').eq('id', ana.id);
      expect(data).toEqual([]);
    });

    /* ESTO ES UNA ESCALADA DE PRIVILEGIOS SI FALLA. La política de RLS deja
       actualizar tu propia fila; lo que impide tocar `plan` es el permiso de
       COLUMNA (`grant update (display_name)`). Las dos capas hacen falta. */
    it('nadie puede subirse de plan solo', async () => {
      await ana.client.from('profiles').update({ plan: 'team' }).eq('id', ana.id);
      const { data } = await ana.client
        .from('profiles')
        .select('plan')
        .eq('id', ana.id)
        .single();
      expect(data!.plan).toBe('free');
    });

    it('sí puede cambiarse el nombre', async () => {
      await ana.client.from('profiles').update({ display_name: 'Ana' }).eq('id', ana.id);
      const { data } = await ana.client
        .from('profiles')
        .select('display_name')
        .eq('id', ana.id)
        .single();
      expect(data!.display_name).toBe('Ana');
    });
  });

  // ── lo que decide el servidor y el cliente no puede tocar ─────────────────

  describe('marca de agua y cuota', () => {
    /* ADR 0005: si la decidiera el cliente sería trivial quitarla. El trigger
       la recalcula desde el plan ANTES de guardar, así que mandarla en el
       payload no sirve de nada. */
    it('se pone desde el plan, aunque se mande lo contrario', async () => {
      const { data } = await ana.client
        .from('charts')
        .insert({
          owner_id: ana.id,
          type: 'donut',
          config: CONFIG,
          watermark: false,
        })
        .select('id, watermark')
        .single();

      expect(data!.watermark).toBe(true);
      await ana.client.from('charts').delete().eq('id', data!.id);
    });

    it('tampoco se puede quitar editando después', async () => {
      await ana.client.from('charts').update({ watermark: false }).eq('id', publica);
      const { data } = await ana.client
        .from('charts')
        .select('watermark')
        .eq('id', publica)
        .single();
      expect(data!.watermark).toBe(true);
    });

    it('el slug se genera solo y no se puede elegir', async () => {
      const { data } = await ana.client
        .from('charts')
        .select('slug')
        .eq('id', publica)
        .single();
      expect(data!.slug).toMatch(/^[2-9a-km-np-zA-HJ-NP-Z]{12}$/);
    });

    /* La cuota vive en un trigger y no en el código de la aplicación porque es
       la única capa por la que pasan todos los caminos, incluido hablar con la
       API de Supabase directamente. */
    it('la cuota del plan gratis corta al llegar al tope', async () => {
      const { data: limite } = await ana.client
        .from('plan_limits')
        .select('max_charts')
        .eq('plan', 'free')
        .single();

      const { count } = await ana.client
        .from('charts')
        .select('id', { count: 'exact', head: true });

      const quedan = limite!.max_charts - (count ?? 0);
      const relleno = Array.from({ length: quedan }, () => ({
        owner_id: ana.id,
        type: 'donut',
        config: CONFIG,
      }));

      // Uno a uno: el trigger es `for each row` y un insert en lote se corta al
      // llegar al tope, que es justo lo que hay que comprobar.
      for (const fila of relleno) {
        const { error } = await ana.client.from('charts').insert(fila);
        expect(error).toBeNull();
      }

      const { error } = await ana.client
        .from('charts')
        .insert({ owner_id: ana.id, type: 'donut', config: CONFIG });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('cuota agotada');
    }, 60_000);
  });
});
