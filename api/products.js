const { setCors } = require('./lib/cors');
const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { status } = req.query;
      let query = supabase.from('products').select('*');
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { name_es } = req.body;
      if (!name_es || typeof name_es !== 'string') return res.status(400).json({ error: 'name_es is required' });
      if (req.body.price_sats !== null && req.body.price_sats !== undefined && (typeof req.body.price_sats !== 'number' || req.body.price_sats < 0)) {
        return res.status(400).json({ error: 'price_sats must be a positive number or null' });
      }
      const { data, error } = await supabase.from('products').insert(req.body).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
