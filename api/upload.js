const REPO = 'juliettech13/personal-analytics';
const GH   = 'https://api.github.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { password, platform, data } = body || {};

  if (!password || password !== process.env.UPLOAD_PASSWORD) {
    return res.status(403).json({ error: 'Invalid password' });
  }
  if (!platform || data == null) {
    return res.status(400).json({ error: 'Missing platform or data' });
  }

  const token = process.env.GH_TOKEN;
  if (!token) return res.status(500).json({ error: 'GH_TOKEN not configured' });

  const filePath = `data/${platform}.json`;

  // Read existing file to get SHA (required for update) and current data
  let existingData = null;
  let sha = null;
  try {
    const r = await fetch(`${GH}/repos/${REPO}/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (r.ok) {
      const file = await r.json();
      sha = file.sha;
      existingData = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    }
  } catch (_) {}

  const merged = mergeData(existingData, data);
  const content = Buffer.from(JSON.stringify(merged, null, 2)).toString('base64');

  const putRes = await fetch(`${GH}/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `sync: ${platform} analytics ${new Date().toISOString().slice(0, 10)}`,
      content,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return res.status(502).json({ error: 'GitHub write failed', detail: err });
  }

  const total = Array.isArray(merged)
    ? merged.length
    : (merged.dailyEngagement?.length ?? 0);

  return res.json({ ok: true, total });
}

function mergeData(existing, incoming) {
  if (!existing) return incoming;

  // Both are plain row arrays — deduplicate by exact JSON match
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const seen = new Set(existing.map(r => JSON.stringify(r)));
    return [...existing, ...incoming.filter(r => !seen.has(JSON.stringify(r)))];
  }

  // LinkedIn structured object (has dailyEngagement sub-arrays)
  if (existing.dailyEngagement && incoming.dailyEngagement) {
    return {
      ...incoming,
      dailyEngagement:  mergeByKey(existing.dailyEngagement,  incoming.dailyEngagement,  'date'),
      topByImpressions: mergeByKey(existing.topByImpressions, incoming.topByImpressions, 'url'),
      topByEngagements: mergeByKey(existing.topByEngagements, incoming.topByEngagements, 'url'),
      demographics:     incoming.demographics?.length ? incoming.demographics : existing.demographics,
    };
  }

  // Incompatible shapes — incoming wins
  return incoming;
}

// Merge two arrays by key; incoming overwrites existing on collision; sorted ascending by key
function mergeByKey(a, b, key) {
  const map = new Map();
  for (const item of (a || [])) if (item[key]) map.set(item[key], item);
  for (const item of (b || [])) if (item[key]) map.set(item[key], item);
  return [...map.values()].sort((x, y) => (x[key] < y[key] ? -1 : 1));
}
