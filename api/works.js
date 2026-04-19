const { setCors } = require('./lib/cors');
const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { artist_id, status } = req.query;
      let query = supabase.from('works').select('*, artists(name, slug)');
      if (artist_id) query = query.eq('artist_id', artist_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { artist_id, title_es } = req.body;
      if (!artist_id) return res.status(400).json({ error: 'artist_id is required' });
      if (!title_es || typeof title_es !== 'string') return res.status(400).json({ error: 'title_es is required' });
      const { data, error } = await supabase.from('works').insert(req.body).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { data, error } = await supabase.from('works').update(updates).eq('id', id).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase.from('works').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
