export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/vehicles') {
      return handleData(request, env, 'vehicles');
    }
    if (url.pathname === '/api/people') {
      return handleData(request, env, 'people');
    }
    // 予約データは同時編集で上書き事故が起きないよう、1件単位のAPIにする
    if (url.pathname === '/api/reservations' || url.pathname.startsWith('/api/reservations/')) {
      return handleReservations(request, env, url);
    }

    // API以外はすべて public フォルダの静的ファイルを返す
    return env.ASSETS.fetch(request);
  },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function readList(env, key) {
  const value = await env.FLEET_KV.get(key);
  try {
    const list = JSON.parse(value ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// vehicles / people 用（管理者が単独で編集することが多いため、従来通り全件読み書き）
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
      return json({ error: 'invalid json' }, 400);
    }
    if (!Array.isArray(body)) {
      return json({ error: 'array expected' }, 400);
    }
    await env.FLEET_KV.put(key, JSON.stringify(body));
    return json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

// reservations 用（複数人が同時に使っても事故らないよう、1件ずつサーバー側で読み書きする）
async function handleReservations(request, env, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ["api","reservations", "<id>"?]
  const id = parts[2];

  // 一覧取得
  if (request.method === 'GET' && !id) {
    const value = await env.FLEET_KV.get('reservations');
    return new Response(value ?? '[]', {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  // 新規追加（1件）
  if (request.method === 'POST' && !id) {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid json' }, 400);
    }
    if (!body || typeof body !== 'object' || !body.id) {
      return json({ error: 'reservation object with id expected' }, 400);
    }
    const list = await readList(env, 'reservations');
    list.push(body);
    await env.FLEET_KV.put('reservations', JSON.stringify(list));
    return json({ ok: true, item: body });
  }

  // 更新（1件）
  if (request.method === 'PUT' && id) {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid json' }, 400);
    }
    const list = await readList(env, 'reservations');
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      return json({ error: 'not found' }, 404);
    }
    list[idx] = { ...body, id };
    await env.FLEET_KV.put('reservations', JSON.stringify(list));
    return json({ ok: true, item: list[idx] });
  }

  // 削除（1件）
  if (request.method === 'DELETE' && id) {
    const list = await readList(env, 'reservations');
    const next = list.filter((r) => r.id !== id);
    await env.FLEET_KV.put('reservations', JSON.stringify(next));
    return json({ ok: true });
  }

  // 互換用: 旧方式（配列まるごと保存）にも一応対応しておく
  if (request.method === 'PUT' && !id) {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid json' }, 400);
    }
    if (!Array.isArray(body)) {
      return json({ error: 'array expected' }, 400);
    }
    await env.FLEET_KV.put('reservations', JSON.stringify(body));
    return json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
