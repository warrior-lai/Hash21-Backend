const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { work_id } = req.query;
  if (!work_id) return res.status(400).json({ error: 'work_id required' });

  try {
    const { data: work, error } = await supabase
      .from('works')
      .select('*, artists(name)')
      .eq('id', work_id)
      .single();

    if (error || !work) return res.status(404).json({ error: 'Work not found' });
    if (!work.certificate_hash) return res.status(400).json({ error: 'Work not certified yet' });

    const artist = work.artists ? work.artists.name : 'Unknown';
    const certDate = work.certificate_date ? new Date(work.certificate_date).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const blockText = work.certificate_block ? `Bloque #${work.certificate_block}` : 'Pendiente de confirmación en blockchain';
    const status = work.certificate_status === 'certified' ? 'CERTIFICADA' : 'PENDIENTE';
    const statusColor = work.certificate_status === 'certified' ? '#2dd4a8' : '#b08d57';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Inter:wght@300;400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#fafaf8; color:#1a1a1a; }
  .cert { max-width:700px; margin:40px auto; padding:50px; border:2px solid #b08d57; position:relative; }
  .cert::before { content:''; position:absolute; top:8px; left:8px; right:8px; bottom:8px; border:1px solid rgba(176,141,87,0.3); }
  .header { text-align:center; margin-bottom:40px; }
  .logo { font-family:'Cormorant Garamond',serif; font-size:28px; color:#b08d57; letter-spacing:3px; }
  .logo span { font-weight:300; }
  .subtitle { font-size:11px; color:#999; letter-spacing:3px; text-transform:uppercase; margin-top:8px; }
  .title { font-family:'Cormorant Garamond',serif; font-size:22px; text-align:center; margin:30px 0; }
  .status { text-align:center; font-size:12px; letter-spacing:2px; color:${statusColor}; font-weight:500; margin-bottom:30px; }
  .details { margin:30px 0; }
  .row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(0,0,0,0.06); font-size:13px; }
  .row .label { color:#999; text-transform:uppercase; letter-spacing:1px; font-size:11px; }
  .row .value { font-weight:500; text-align:right; max-width:60%; word-break:break-all; }
  .hash { font-family:monospace; font-size:11px; background:#f2f0ec; padding:15px; border-radius:4px; word-break:break-all; margin:20px 0; text-align:center; color:#666; }
  .footer { text-align:center; margin-top:40px; font-size:10px; color:#999; line-height:1.8; }
  .verify { font-size:11px; color:#b08d57; text-decoration:none; }
  .seal { text-align:center; font-size:48px; margin:20px 0; opacity:0.15; }
</style></head><body>
<div class="cert">
  <div class="header">
    <div class="logo">HASH<span>21</span></div>
    <div class="subtitle">Certificado de Registro On-Chain</div>
  </div>
  
  <div class="status">● ${status}</div>
  
  <div class="title">"${work.title_es}"</div>
  
  <div class="details">
    <div class="row"><span class="label">Artista</span><span class="value">${artist}</span></div>
    <div class="row"><span class="label">Técnica</span><span class="value">${work.technique || '—'}</span></div>
    <div class="row"><span class="label">Tipo</span><span class="value">${work.type === 'physical' ? 'Obra Física' : 'Obra Digital'}</span></div>
    <div class="row"><span class="label">Fecha de registro</span><span class="value">${certDate}</span></div>
    <div class="row"><span class="label">Bloque Bitcoin</span><span class="value">${blockText}</span></div>
  </div>
  
  <div class="hash">${work.certificate_hash}</div>
  
  <div class="qr-section" style="text-align:center;margin:30px 0;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://hash21.studio/verify/?hash=${work.certificate_hash}" alt="QR Verificación" style="width:120px;height:120px;">
    <div style="font-size:10px;color:#999;margin-top:8px;">Escaneá para verificar</div>
  </div>
  
  <div class="footer">
    Este certificado prueba que el archivo digital de la obra existía<br>
    en la fecha indicada, anclado en la blockchain de Bitcoin via OpenTimestamps.<br>
    No certifica autoría — certifica existencia en el tiempo.<br><br>
    <a class="verify" href="https://hash21.studio/verify/?hash=${work.certificate_hash}">Verificar en hash21.studio/verify</a><br><br>
    Hash21 · Permanencia para la obra. Soberanía para el artista. ⚡
  </div>
</div>
</body></html>`;

    // Return HTML (browser can print to PDF)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
