export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/vehicles') {
      return handleData(request, env, 'vehicles');
    }
    if (url.pathname === '/api/reservations') {
      return handleData(request, env, 'reservations');
    }

    // API以外はすべて public フォルダの静的ファイルを返す
    return env.ASSETS.fetch(request);
  },
};

async function handleData(request, env, key) {
  if (request.method === 'GET') {
    const value = await env.FLEET_KV.get(key);
    return new Response(value ?? '[]', {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'invalid json' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    if (!Array.isArray(body)) {
      return new Response(JSON.stringify({ error: 'array expected' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    await env.FLEET_KV.put(key, JSON.stringify(body));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
