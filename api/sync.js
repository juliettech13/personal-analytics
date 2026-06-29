export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = process.env.GH_TOKEN;
  if (!token) return res.status(500).json({ error: 'GH_TOKEN not configured' });

  const r = await fetch(
    'https://api.github.com/repos/juliettech13/personal-analytics/actions/workflows/instagram-sync.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'master' }),
    }
  );

  if (r.status === 204) return res.status(204).end();
  const body = await r.text();
  return res.status(r.status).json({ error: body });
}
