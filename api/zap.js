// Hash21 Zap API — Signs NIP-57 zap requests and returns invoice from artist's wallet
const { finishEvent, nip19 } = require('nostr-tools');

// Artist Lightning Addresses
const ARTIST_LN = {
  'lai': 'crustycoil11@walletofsatoshi.com',
  'roxy': 'crustycoil11@walletofsatoshi.com',   // TODO: replace with Roxy's
  'martu': 'crustycoil11@walletofsatoshi.com',   // TODO: replace
  'guadis': 'crustycoil11@walletofsatoshi.com',  // TODO: replace
};

// Obra → artist mapping
const OBRA_ARTIST = {
  'the-rabbit': 'lai',
  'the-hole': 'lai',
  'libertad': 'lai',
  'horizonte-temporal': 'lai',
  'paspartuz-1': 'roxy',
  'paspartuz-2': 'roxy',
};

async function resolveLnAddress(address) {
  const [user, domain] = address.split('@');
  const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
  if (!res.ok) throw new Error('Failed to resolve Lightning Address');
  return await res.json();
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { target, amount, message } = req.body;
    if (!target || !amount || amount < 1) {
      return res.status(400).json({ error: 'Missing target or amount' });
    }

    // Determine artist
    const artist = OBRA_ARTIST[target] || target;
    const lnAddress = ARTIST_LN[artist] || ARTIST_LN['lai'];

    // Resolve Lightning Address
    const lnurlData = await resolveLnAddress(lnAddress);
    if (!lnurlData.callback || !lnurlData.allowsNostr || !lnurlData.nostrPubkey) {
      return res.status(500).json({ error: 'Lightning Address does not support Nostr zaps' });
    }

    // Decode nsec from env
    const nsecKey = process.env.HASH21_NOSTR_NSEC;
    if (!nsecKey) return res.status(500).json({ error: 'Server Nostr key not configured' });
    const { data: secretKey } = nip19.decode(nsecKey);

    // Build zap request (kind 9734) per NIP-57
    const amountMsat = amount * 1000;
    const relays = [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.primal.net'
    ];

    const zapRequest = {
      kind: 9734,
      created_at: Math.floor(Date.now() / 1000),
      content: message || '',
      tags: [
        ['relays', ...relays],
        ['amount', amountMsat.toString()],
        ['p', lnurlData.nostrPubkey],
      ],
    };

    // Sign the zap request
    const signedZapRequest = finishEvent(zapRequest, secretKey);

    // Request invoice from artist's wallet with nostr param
    const encodedZap = encodeURIComponent(JSON.stringify(signedZapRequest));
    let callbackUrl = `${lnurlData.callback}?amount=${amountMsat}&nostr=${encodedZap}`;
    if (message && lnurlData.commentAllowed > 0) {
      callbackUrl += `&comment=${encodeURIComponent(message)}`;
    }

    const invoiceRes = await fetch(callbackUrl);
    const invoiceData = await invoiceRes.json();

    if (!invoiceData.pr) {
      return res.status(500).json({ error: 'No invoice received from wallet', detail: invoiceData });
    }

    return res.status(200).json({
      invoice: invoiceData.pr,
      zapRequest: signedZapRequest,
      artist: artist,
      lnAddress: lnAddress,
    });

  } catch (e) {
    console.error('Zap API error:', e);
    return res.status(500).json({ error: e.message });
  }
};
