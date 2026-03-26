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
    const certDate = work.certificate_date 
      ? new Date(work.certificate_date).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }) 
      : '';
    const certDateISO = work.certificate_date 
      ? new Date(work.certificate_date).toISOString().split('T')[0]
      : '';
    const blockNum = work.certificate_block || null;
    const isCertified = work.certificate_status === 'certified';
    const verifyUrl = `https://hash21.studio/verify/?hash=${work.certificate_hash}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&bgcolor=0a0a0a&color=c9a227&data=${encodeURIComponent(verifyUrl)}`;

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Certificado — ${work.title_es} — Hash21</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @page { 
    size: A4; 
    margin: 0; 
  }
  
  body { 
    font-family: 'Inter', -apple-system, sans-serif;
    background: #0a0a0a;
    color: #f5f5f5;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .cert {
    width: 100%;
    max-width: 600px;
    background: #0a0a0a;
    border: 1px solid #1a1a1a;
    position: relative;
    padding: 60px 50px;
  }
  
  /* Corner accents */
  .cert::before,
  .cert::after {
    content: '';
    position: absolute;
    width: 60px;
    height: 60px;
    border: 1px solid #c9a227;
  }
  .cert::before {
    top: 20px;
    left: 20px;
    border-right: none;
    border-bottom: none;
  }
  .cert::after {
    bottom: 20px;
    right: 20px;
    border-left: none;
    border-top: none;
  }
  
  /* Header */
  .header {
    text-align: center;
    margin-bottom: 50px;
  }
  
  .logo {
    font-size: 32px;
    font-weight: 600;
    letter-spacing: 8px;
    margin-bottom: 8px;
  }
  
  .logo span { color: #c9a227; }
  
  .cert-type {
    font-size: 10px;
    letter-spacing: 4px;
    color: #666;
    text-transform: uppercase;
  }
  
  /* Divider */
  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #333, transparent);
    margin: 40px 0;
  }
  
  /* Title */
  .work-title {
    text-align: center;
    font-size: 28px;
    font-weight: 300;
    letter-spacing: 2px;
    margin-bottom: 8px;
    color: #fff;
  }
  
  .work-artist {
    text-align: center;
    font-size: 14px;
    color: #c9a227;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  
  /* Status badge */
  .status {
    text-align: center;
    margin: 30px 0;
  }
  
  .status-badge {
    display: inline-block;
    padding: 8px 24px;
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    border-radius: 2px;
    background: ${isCertified ? 'rgba(34,197,94,0.1)' : 'rgba(201,162,39,0.1)'};
    color: ${isCertified ? '#22c55e' : '#c9a227'};
    border: 1px solid ${isCertified ? 'rgba(34,197,94,0.3)' : 'rgba(201,162,39,0.3)'};
  }
  
  /* Details grid */
  .details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px 40px;
    margin: 40px 0;
  }
  
  .detail {
    text-align: center;
  }
  
  .detail-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  
  .detail-value {
    font-size: 13px;
    color: #ccc;
  }
  
  /* Hash */
  .hash-section {
    background: #111;
    border: 1px solid #1a1a1a;
    padding: 20px;
    margin: 30px 0;
    text-align: center;
  }
  
  .hash-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  
  .hash-value {
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 11px;
    color: #c9a227;
    word-break: break-all;
    line-height: 1.8;
  }
  
  /* QR + Verify */
  .verify-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 30px;
    margin: 40px 0;
    padding: 30px;
    background: #0d0d0d;
    border: 1px solid #1a1a1a;
  }
  
  .qr-code {
    width: 100px;
    height: 100px;
  }
  
  .verify-text {
    text-align: left;
  }
  
  .verify-text h4 {
    font-size: 11px;
    letter-spacing: 2px;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 8px;
    font-weight: 400;
  }
  
  .verify-text p {
    font-size: 12px;
    color: #888;
    line-height: 1.6;
  }
  
  .verify-text a {
    color: #c9a227;
    text-decoration: none;
    font-size: 11px;
  }
  
  /* Footer */
  .footer {
    text-align: center;
    margin-top: 40px;
    padding-top: 30px;
    border-top: 1px solid #1a1a1a;
  }
  
  .footer p {
    font-size: 10px;
    color: #555;
    line-height: 1.8;
  }
  
  .footer-logo {
    font-size: 12px;
    letter-spacing: 4px;
    color: #333;
    margin-top: 20px;
  }
  
  .footer-logo span { color: #4a3d1a; }
  
  /* Bitcoin symbol watermark */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 300px;
    color: #0d0d0d;
    pointer-events: none;
    z-index: 0;
  }
  
  .content {
    position: relative;
    z-index: 1;
  }
</style>
</head>
<body>

<div class="cert">
  <div class="watermark">₿</div>
  
  <div class="content">
    <div class="header">
      <div class="logo">HASH<span>21</span></div>
      <div class="cert-type">Certificado de Autenticidad</div>
    </div>
    
    <div class="divider"></div>
    
    <h1 class="work-title">${work.title_es}</h1>
    <p class="work-artist">${artist}</p>
    
    <div class="status">
      <span class="status-badge">${isCertified ? '● Verificado en Bitcoin' : '○ Pendiente de confirmación'}</span>
    </div>
    
    <div class="details">
      <div class="detail">
        <div class="detail-label">Técnica</div>
        <div class="detail-value">${work.technique || '—'}</div>
      </div>
      <div class="detail">
        <div class="detail-label">Tipo</div>
        <div class="detail-value">${work.type === 'physical' ? 'Obra Física' : 'Digital'}</div>
      </div>
      <div class="detail">
        <div class="detail-label">Fecha de Registro</div>
        <div class="detail-value">${certDateISO || '—'}</div>
      </div>
      <div class="detail">
        <div class="detail-label">Bloque Bitcoin</div>
        <div class="detail-value">${blockNum ? `#${blockNum.toLocaleString()}` : 'Pendiente'}</div>
      </div>
    </div>
    
    <div class="hash-section">
      <div class="hash-label">SHA-256 Hash</div>
      <div class="hash-value">${work.certificate_hash}</div>
    </div>
    
    <div class="verify-section">
      <img src="${qrUrl}" class="qr-code" alt="QR Verificación">
      <div class="verify-text">
        <h4>Verificación</h4>
        <p>Escaneá el código QR o visitá:</p>
        <a href="${verifyUrl}">hash21.studio/verify</a>
      </div>
    </div>
    
    <div class="footer">
      <p>
        Este certificado prueba que la huella digital de la obra<br>
        fue registrada en la blockchain de Bitcoin mediante OpenTimestamps.<br>
        Certifica existencia en el tiempo, no autoría.
      </p>
      <div class="footer-logo">HASH<span>21</span></div>
    </div>
  </div>
</div>

</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
