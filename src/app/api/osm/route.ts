export const runtime = "nodejs";

const cache = new Map<string, { timestamp: number; payload: any }>();
const inflight = new Map<string, Promise<any>>();

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function parseNumber(value: string | null) {
  if (value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bboxParam = url.searchParams.get("bbox");

  let s: number | null = null;
  let w: number | null = null;
  let n: number | null = null;
  let e: number | null = null;

  if (bboxParam) {
    const parts = bboxParam.split(",").map((p) => Number(p));
    if (parts.length === 4 && parts.every((p) => Number.isFinite(p))) {
      [s, w, n, e] = parts;
    }
  } else {
    s = parseNumber(url.searchParams.get("s"));
    w = parseNumber(url.searchParams.get("w"));
    n = parseNumber(url.searchParams.get("n"));
    e = parseNumber(url.searchParams.get("e"));
  }

  if (s === null || w === null || n === null || e === null) {
    return Response.json(
      { error: "Invalid bbox. Provide bbox=s,w,n,e or s,w,n,e params." },
      { status: 400 }
    );
  }

  const cacheKey = `${s},${w},${n},${e}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return Response.json(cached.payload, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  }

  if (inflight.has(cacheKey)) {
    const payload = await inflight.get(cacheKey)!;
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  }

  const query = `
    [out:json][timeout:5];
    (
      node["amenity"](${s},${w},${n},${e});
      node["leisure"](${s},${w},${n},${e});
      node["tourism"](${s},${w},${n},${e});
    );
    out body;
  `;

  const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  const requestPromise = fetch(overpassUrl, {
    headers: {
      "User-Agent": "norby-app/1.0",
    },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Overpass error: ${res.status}`);
      }
      const data = await res.json();
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      const namedPlaces = elements.filter((el: any) => el?.tags?.name);
      return { elements: namedPlaces };
    })
    .then((payload) => {
      cache.set(cacheKey, { timestamp: Date.now(), payload });
      return payload;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, requestPromise);

  try {
    const payload = await requestPromise;
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Overpass request failed" },
      { status: 502 }
    );
  }
}
