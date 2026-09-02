// Cloudflare Pages Function backed by KV.
// Bind a KV namespace named WISHLIST in the Pages project settings.
// One key per reserved item id (value "1") — avoids the read-modify-write
// race a single JSON-array key would have.

function noBinding(env) {
  if (!env.WISHLIST) {
    return new Response("KV binding 'WISHLIST' is not configured", { status: 500 });
  }
}

export async function onRequestGet({ env }) {
  const err = noBinding(env);
  if (err) return err;
  const list = await env.WISHLIST.list();
  // Reserver name lives in KV metadata, so listing needs no extra reads.
  const reserved = list.keys.map((k) => ({ id: k.name, by: k.metadata?.by || null }));
  return Response.json({ reserved });
}

export async function onRequestPost({ env, request }) {
  const err = noBinding(env);
  if (err) return err;
  const { id, title, by } = await request.json().catch(() => ({}));
  if (!id) return new Response("missing id", { status: 400 });

  // ponytail: KV has no transactions, so get-then-put isn't atomic; two
  // truly-simultaneous reserves could both win. Fine for a family wishlist.
  if (await env.WISHLIST.get(id)) {
    return Response.json({ reserved: true }, { status: 409 });
  }
  // Value + metadata carry who reserved what; metadata is returned by list().
  const info = { title: title || null, by: by || null, at: new Date().toISOString() };
  await env.WISHLIST.put(id, JSON.stringify(info), { metadata: info });
  return Response.json({ ok: true });
}
