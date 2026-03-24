const supabase = require('./lib/supabase');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST — initiate certification (calculate hash + submit to OTS)
  if (req.method === 'POST') {
    const { work_id, image_url } = req.body;
    
    if (!work_id) return res.status(400).json({ error: 'work_id is required' });
    
    try {
      // Get the work
      const { data: work, error: workErr } = await supabase
        .from('works')
        .select('*')
        .eq('id', work_id)
        .single();
      
      if (workErr || !work) return res.status(404).json({ error: 'Work not found' });
      if (work.certificate_status === 'certified') {
        return res.status(400).json({ error: 'Work already certified', hash: work.certificate_hash, block: work.certificate_block });
      }
      
      // Calculate SHA-256 of the image
      const imgUrl = image_url || work.image_url;
      if (!imgUrl) return res.status(400).json({ error: 'No image URL for this work' });
      
      // Fetch image and hash it
      const fullUrl = imgUrl.startsWith('http') ? imgUrl : `https://hash21.studio${imgUrl}`;
      const imgRes = await fetch(fullUrl);
      if (!imgRes.ok) return res.status(500).json({ error: 'Could not fetch image' });
      
      const buffer = await imgRes.arrayBuffer();
      const hash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
      
      // Submit to OpenTimestamps calendar servers
      const otsCalendars = [
        'https://a.pool.opentimestamps.org/digest',
        'https://b.pool.opentimestamps.org/digest',
        'https://a.pool.eternitywall.com/digest'
      ];
      
      let submitted = false;
      for (const calendar of otsCalendars) {
        try {
          const otsRes = await fetch(calendar, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: Buffer.from(hash, 'hex')
          });
          if (otsRes.ok) {
            submitted = true;
            break;
          }
        } catch(e) { continue; }
      }
      
      // Update work in DB
      const { data: updated, error: updateErr } = await supabase
        .from('works')
        .update({
          certificate_hash: hash,
          certificate_status: submitted ? 'pending' : 'hash_only',
          certificate_date: new Date().toISOString()
        })
        .eq('id', work_id)
        .select()
        .single();
      
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      
      return res.status(200).json({
        hash: hash,
        status: submitted ? 'pending' : 'hash_only',
        message: submitted 
          ? 'Hash submitted to OpenTimestamps. Will be anchored in a Bitcoin block within hours.'
          : 'Hash calculated. Manual OTS submission needed.',
        work: updated
      });
      
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET — check certification status
  if (req.method === 'GET') {
    const { work_id } = req.query;
    if (!work_id) return res.status(400).json({ error: 'work_id required' });
    
    const { data, error } = await supabase
      .from('works')
      .select('id, title_es, certificate_hash, certificate_block, certificate_date, certificate_status')
      .eq('id', work_id)
      .single();
    
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
