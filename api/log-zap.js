const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { target_type, target_id, amount_sats, message, receipt_id } = req.body;
    
    if (!target_type || !target_id || !amount_sats) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (typeof amount_sats !== 'number' || amount_sats < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!['artist', 'work', 'product'].includes(target_type)) {
      return res.status(400).json({ error: 'Invalid target_type' });
    }

    const { data, error } = await supabase.from('zaps').insert({
      target_type,
      target_id: String(target_id).substring(0, 200),
      amount_sats: Math.floor(amount_sats),
      message: message ? String(message).substring(0, 255) : null,
      receipt_id: receipt_id ? String(receipt_id).substring(0, 200) : null
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }

  // GET — zap stats
  if (req.method === 'GET') {
    const { target_id, target_type } = req.query;
    let query = supabase.from('zaps').select('*');
    if (target_id) query = query.eq('target_id', target_id);
    if (target_type) query = query.eq('target_type', target_type);
    query = query.order('created_at', { ascending: false }).limit(100);
    
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    
    // Calculate totals
    const total_sats = data.reduce((sum, z) => sum + z.amount_sats, 0);
    const total_zaps = data.length;
    
    return res.status(200).json({ zaps: data, total_sats, total_zaps });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
