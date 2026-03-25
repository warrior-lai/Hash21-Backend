const supabase = require('./lib/supabase');

// Simple auth endpoint - checks user role
// Does NOT replace Supabase Auth - works alongside it

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/auth?email=xxx — check user role
  if (req.method === 'GET') {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, artist_id, status')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found', registered: false });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account not active', status: user.status });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      role: user.role,
      artist_id: user.artist_id,
      status: user.status
    });
  }

  // POST /api/auth — register new user (pending approval)
  if (req.method === 'POST') {
    const { email, artist_id } = req.body;
    
    if (!email) return res.status(400).json({ error: 'email required' });

    // Check if already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user (pending by default)
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        role: 'artist',
        artist_id: artist_id || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({
      message: 'Registration pending approval',
      user: newUser
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
