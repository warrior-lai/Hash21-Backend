const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hash } = req.query;
  
  if (!hash || hash.length !== 64) {
    return res.status(400).json({ error: 'Invalid hash. Must be 64 character SHA-256 hex string.' });
  }

  try {
    // Search by hash in works table
    const { data: work, error } = await supabase
      .from('works')
      .select('*, artists(name)')
      .eq('certificate_hash', hash.toLowerCase())
      .single();

    if (error || !work) {
      return res.status(404).json({ 
        verified: false,
        error: 'Hash not found in database',
        hash: hash
      });
    }

    // Return verification result
    const result = {
      verified: true,
      hash: work.certificate_hash,
      title: work.title_es,
      title_en: work.title_en,
      artist: work.artists ? work.artists.name : 'Unknown',
      technique: work.technique,
      type: work.type,
      year: work.year || new Date(work.created_at).getFullYear(),
      image: work.image_url,
      certification: {
        status: work.certificate_status,
        date: work.certificate_date,
        block: work.certificate_block,
        service: 'OpenTimestamps',
        algorithm: 'SHA-256'
      }
    };

    // Add mempool link if we have block number
    if (work.certificate_block) {
      result.certification.mempool_url = `https://mempool.space/block/${work.certificate_block}`;
    }

    return res.status(200).json(result);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
