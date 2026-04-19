const { setCors } = require('./lib/cors');
const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { bucket, filename, fileBase64, contentType } = req.body;
    
    if (!bucket || !filename || !fileBase64) {
      return res.status(400).json({ error: 'Missing bucket, filename, or fileBase64' });
    }

    // Decode base64
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filename, fileBuffer, {
        contentType: contentType || 'image/jpeg',
        upsert: true
      });

    if (error) return res.status(400).json({ error: error.message });

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);

    return res.status(200).json({ 
      path: data.path,
      url: urlData.publicUrl
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
