const { setCors } = require('./lib/cors');
// Check if a zap receipt exists for a given zap request
const WebSocket = require('ws');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { zapRequestId, recipientPubkey, since } = req.query;
  if (!zapRequestId || !recipientPubkey) {
    return res.status(400).json({ error: 'Missing zapRequestId or recipientPubkey' });
  }

  const sinceTime = parseInt(since) || Math.floor(Date.now() / 1000) - 120;
  const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
  
  try {
    const result = await new Promise((resolve) => {
      let found = false;
      let closed = 0;
      
      const timeout = setTimeout(() => {
        if (!found) resolve({ paid: false });
      }, 5000);

      relays.forEach(relayUrl => {
        try {
          const ws = new WebSocket(relayUrl);
          
          ws.on('open', () => {
            ws.send(JSON.stringify([
              'REQ', 'check',
              { kinds: [9735], '#p': [recipientPubkey], since: sinceTime, limit: 10 }
            ]));
          });

          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data);
              if (msg[0] === 'EVENT' && msg[2] && msg[2].kind === 9735 && !found) {
                const descTag = msg[2].tags.find(t => t[0] === 'description');
                if (descTag) {
                  const zapReq = JSON.parse(descTag[1]);
                  if (zapReq.id === zapRequestId) {
                    found = true;
                    clearTimeout(timeout);
                    resolve({ paid: true, receiptId: msg[2].id });
                    // Close all
                    relays.forEach(() => { try { ws.close(); } catch(e) {} });
                  }
                }
              }
            } catch(e) {}
          });

          ws.on('error', () => {});
          ws.on('close', () => {
            closed++;
            if (closed >= relays.length && !found) {
              clearTimeout(timeout);
              resolve({ paid: false });
            }
          });

          setTimeout(() => { try { ws.close(); } catch(e) {} }, 4500);
        } catch(e) {}
      });
    });

    return res.status(200).json(result);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
