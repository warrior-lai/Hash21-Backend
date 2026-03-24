const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — list all artists (or one by slug)
    if (req.method === 'GET') {
      const { slug, status } = req.query;
      let query = supabase.from('artists').select('*');
      if (slug) query = query.eq('slug', slug).single();
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }

    // POST — create artist
    if (req.method === 'POST') {
      const { name, slug } = req.body;
      if (!name || typeof name !== 'string' || name.length < 1) return res.status(400).json({ error: 'Name is required' });
      if (!slug || typeof slug !== 'string' || !/^[a-z0-9\-]+$/.test(slug)) return res.status(400).json({ error: 'Valid slug is required (lowercase, no spaces)' });
      const { data, error } = await supabase.from('artists').insert(req.body).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json(data);
    }

    // PUT — update artist
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { data, error } = await supabase.from('artists').update(updates).eq('id', id).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }

    // DELETE — delete artist
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase.from('artists').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
