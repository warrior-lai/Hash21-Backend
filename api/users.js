const { setCors } = require('./lib/cors');
const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — list all users
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('users')
      .select('*, artists(name)')
      .order('created_at', { ascending: false });
    
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — create user (simple version without Auth)
  if (req.method === 'POST') {
    const { email, role, artist_id, status } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        role: role || 'artist',
        artist_id: artist_id || null,
        status: status || 'pending'
      })
      .select('*, artists(name)')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }

  // PUT — update user
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Remove password from updates (not handled in simple version)
    delete updates.password;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*, artists(name)')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — delete user
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
