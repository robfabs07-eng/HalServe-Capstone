// Vercel Serverless Function: /api/livekit-token.js
// Deploy this to Vercel and set LIVEKIT_API_KEY + LIVEKIT_API_SECRET
// as Environment Variables in your Vercel project dashboard.
//
// Install dependency: npm install livekit-server-sdk
// Then import below will work.

export default async function handler(req, res) {
  // Allow CORS from your SmartServe domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { room, identity } = req.query;

  if (!room || !identity) {
    return res.status(400).json({ error: 'Missing required params: room, identity' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Server not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET env vars.' });
  }

  try {
    // Dynamically import to avoid issues with build systems
    const { AccessToken } = await import('livekit-server-sdk');

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: '2h', // Token valid for 2 hours
    });

    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();
    return res.status(200).json({ token: jwt });
  } catch (e) {
    console.error('Token generation error:', e);
    return res.status(500).json({ error: 'Failed to generate token: ' + e.message });
  }
}
