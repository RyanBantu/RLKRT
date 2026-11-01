// Vercel function: GET /api/ebird?lat=..&lng=..&dist=..&back=..
// Proxies eBird API 2.0 "recent nearby observations" and adds the secret key server-side.
// The key comes from EBIRD_API_KEY and is never returned or logged.

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

const num = (v: string | null, min: number, max: number) => {
  const n = Number(v);
  return v !== null && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export async function GET(request: Request) {
  const key = process.env.EBIRD_API_KEY;
  if (!key) return json({ error: 'not_configured' }, 503);

  const q = new URL(request.url).searchParams;
  const lat = num(q.get('lat'), -90, 90);
  const lng = num(q.get('lng'), -180, 180);
  if (lat === null || lng === null) return json({ error: 'bad_request' }, 400);
  const dist = Math.round(num(q.get('dist'), 1, 50) ?? 25);
  const back = Math.round(num(q.get('back'), 1, 30) ?? 7);

  const url =
    `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}` +
    `&dist=${dist}&back=${back}&maxResults=2000`;
  try {
    const r = await fetch(url, { headers: { 'X-eBirdApiToken': key }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return json({ error: r.status === 403 ? 'bad_key' : 'upstream', status: r.status }, 502);
    return new Response(await r.text(), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=600, stale-while-revalidate=300',
      },
    });
  } catch {
    return json({ error: 'timeout' }, 504);
  }
}
