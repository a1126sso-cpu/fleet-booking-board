// GET  /api/vehicles  -> 車両一覧を返す
// PUT  /api/vehicles  -> 車両一覧を保存する
// Cloudflare Pages の KV バインディング名は "FLEET_KV" を想定しています。

const KEY = 'vehicles';

export async function onRequestGet({ env }) {
  const value = await env.FLEET_KV.get(KEY);
  return new Response(value ?? '[]', {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPut({ request, env }) {
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
  await env.FLEET_KV.put(KEY, JSON.stringify(body));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
