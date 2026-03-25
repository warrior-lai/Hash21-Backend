const { createClient } = require('@supabase/supabase-js');

// Create admin client for auth operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// Regular client for DB operations
const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  // POST — create user with Supabase Auth
  if (req.method === 'POST') {
    const { email, password, role, artist_id, status } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'password required (min 6 chars)' });

    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true // Auto-confirm email
      });

      if (authError) return res.status(400).json({ error: authError.message });

      // 2. Create user record in users table
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id, // Use same ID as Auth
          email: email.toLowerCase(),
          role: role || 'artist',
          artist_id: artist_id || null,
          status: status || 'active'
        })
        .select('*, artists(name)')
        .single();

      if (dbError) {
        // Rollback: delete auth user if db insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ error: dbError.message });
      }

      return res.status(201).json(userData);

    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PUT — update user
  if (req.method === 'PUT') {
    const { id, password, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Update password in Auth if provided
    if (password && password.length >= 6) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password
      });
      if (authError) return res.status(400).json({ error: 'Failed to update password: ' + authError.message });
    }

    // Update user record
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*, artists(name)')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — delete user from both Auth and DB
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Delete from Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) console.log('Auth delete warning:', authError.message);

    // Delete from DB
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
