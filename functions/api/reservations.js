// Cloudflare Pages Function backed by KV.
// Bind a KV namespace named WISHLIST in the Pages project settings.
// One key per reserved item id (value "1") — avoids the read-modify-write
// race a single JSON-array key would have.

export async function onRequestGet({ env }) {
  const list = await env.WISHLIST.list();
  return Response.json({ ids: list.keys.map((k) => k.name) });
}

export async function onRequestPost({ env, request }) {
  const { id, title, by } = await request.json().catch(() => ({}));
  if (!id) return new Response("missing id", { status: 400 });

  // ponytail: KV has no transactions, so get-then-put isn't atomic; two
  // truly-simultaneous reserves could both win. Fine for a family wishlist.
  if (await env.WISHLIST.get(id)) {
    return Response.json({ reserved: true }, { status: 409 });
  }
  // Value carries who reserved what, so the KV browser is readable.
  const value = JSON.stringify({ title: title || null, by: by || null, at: new Date().toISOString() });
  await env.WISHLIST.put(id, value);
  return Response.json({ ok: true });
}
