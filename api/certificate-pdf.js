const { setCors } = require('./lib/cors');
const supabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
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
    const blockNum = work.certificate_block || null;
    const isCertified = work.certificate_status === 'certified';
    const verifyUrl = `https://hash21.studio/verify/?hash=${work.certificate_hash}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&bgcolor=ffffff&color=1a1a1a&data=${encodeURIComponent(verifyUrl)}`;

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Certificado — ${work.title_es} — Hash21</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @page { 
    size: 250mm 250mm; 
    margin: 0; 
  }
  
  body { 
    font-family: 'Inter', -apple-system, sans-serif;
    background: #f8f7f4;
    color: #1a1a1a;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .cert {
    width: 250mm;
    height: 250mm;
    background: #ffffff;
    position: relative;
    padding: 50px;
    box-shadow: 0 4px 30px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  
  /* Elegant border */
  .cert::before {
    content: '';
    position: absolute;
    top: 15px;
    left: 15px;
    right: 15px;
    bottom: 15px;
    border: 1px solid #c9a227;
  }
  
  .cert::after {
    content: '';
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    bottom: 20px;
    border: 1px solid rgba(201,162,39,0.3);
  }
  
  .content {
    position: relative;
    z-index: 1;
  }
  
  /* Header */
  .header {
    text-align: center;
    margin-bottom: 40px;
  }
  
  .logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px;
    font-weight: 400;
    letter-spacing: 6px;
    color: #1a1a1a;
  }
  
  .logo span { color: #c9a227; }
  
  .cert-type {
    font-family: 'Cormorant Garamond', serif;
    font-size: 14px;
    letter-spacing: 6px;
    color: #999;
    text-transform: uppercase;
    margin-top: 10px;
  }
  
  /* Ornament */
  .ornament {
    text-align: center;
    margin: 30px 0;
    color: #c9a227;
    font-size: 20px;
    letter-spacing: 10px;
  }
  
  /* Title */
  .work-section {
    text-align: center;
    margin: 40px 0;
  }
  
  .work-label {
    font-size: 10px;
    letter-spacing: 3px;
    color: #999;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  
  .work-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px;
    font-weight: 500;
    font-style: italic;
    color: #1a1a1a;
    margin-bottom: 15px;
  }
  
  .work-artist {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    color: #666;
    letter-spacing: 2px;
  }
  
  /* Status seal */
  .seal {
    text-align: center;
    margin: 35px 0;
  }
  
  .seal-badge {
    display: inline-block;
    padding: 10px 30px;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    border: 2px solid ${isCertified ? '#c9a227' : '#999'};
    color: ${isCertified ? '#c9a227' : '#999'};
    font-weight: 500;
  }
  
  /* Details */
  .details {
    display: flex;
    justify-content: center;
    gap: 50px;
    margin: 40px 0;
    padding: 25px 0;
    border-top: 1px solid #eee;
    border-bottom: 1px solid #eee;
  }
  
  .detail {
    text-align: center;
  }
  
  .detail-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: #999;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  
  .detail-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 15px;
    color: #333;
  }
  
  /* Hash */
  .hash-section {
    background: #fafaf8;
    border: 1px solid #eee;
    padding: 20px 25px;
    margin: 30px 0;
    text-align: center;
  }
  
  .hash-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: #999;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  
  .hash-value {
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 10px;
    color: #666;
    word-break: break-all;
    line-height: 1.8;
  }
  
  /* QR + Verify */
  .verify-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 25px;
    margin: 35px 0;
  }
  
  .qr-code {
    width: 80px;
    height: 80px;
    padding: 5px;
    border: 1px solid #eee;
  }
  
  .verify-text {
    text-align: left;
  }
  
  .verify-text h4 {
    font-size: 9px;
    letter-spacing: 2px;
    color: #999;
    text-transform: uppercase;
    margin-bottom: 6px;
    font-weight: 400;
  }
  
  .verify-text a {
    color: #c9a227;
    text-decoration: none;
    font-size: 12px;
  }
  
  /* Footer */
  .footer {
    text-align: center;
    margin-top: 40px;
    padding-top: 25px;
    border-top: 1px solid #eee;
  }
  
  .footer p {
    font-size: 9px;
    color: #999;
    line-height: 1.9;
    max-width: 400px;
    margin: 0 auto;
  }
  
  .footer-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 14px;
    letter-spacing: 4px;
    color: #ccc;
    margin-top: 20px;
  }
  
  .footer-logo span { color: #ddd; }
  
  /* Watermark */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 250px;
    color: rgba(0,0,0,0.02);
    pointer-events: none;
    z-index: 0;
    font-family: serif;
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
    
    <div class="ornament">✦ ✦ ✦</div>
    
    <div class="work-section">
      <div class="work-label">Obra Certificada</div>
      <h1 class="work-title">"${work.title_es}"</h1>
      <p class="work-artist">por ${artist}</p>
    </div>
    
    <div class="seal">
      <span class="seal-badge">${isCertified ? '✓ Verificado en Bitcoin' : '○ Pendiente de confirmación'}</span>
    </div>
    
    <div class="details">
      <div class="detail">
        <div class="detail-label">Técnica</div>
        <div class="detail-value">${work.technique || '—'}</div>
      </div>
      <div class="detail">
        <div class="detail-label">Fecha</div>
        <div class="detail-value">${certDate || '—'}</div>
      </div>
      <div class="detail">
        <div class="detail-label">Bloque</div>
        <div class="detail-value">${blockNum ? `#${blockNum.toLocaleString()}` : 'Pendiente'}</div>
      </div>
    </div>
    
    <div class="hash-section">
      <div class="hash-label">Huella Digital SHA-256</div>
      <div class="hash-value">${work.certificate_hash}</div>
    </div>
    
    <div class="verify-section">
      <img src="${qrUrl}" class="qr-code" alt="QR">
      <div class="verify-text">
        <h4>Verificación</h4>
        <a href="${verifyUrl}">hash21.studio/verify</a>
      </div>
    </div>
    
    <div class="footer">
      <p>
        Este documento certifica que la huella digital de la obra fue registrada<br>
        en la blockchain de Bitcoin mediante OpenTimestamps.<br>
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
