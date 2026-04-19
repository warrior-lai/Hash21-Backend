// CORS middleware — restrict to Hash21 domains only
const ALLOWED_ORIGINS = [
  'https://hash21.studio',
  'https://www.hash21.studio',
  'https://subastas.hash21.studio',
]

function setCors(req, res) {
  const origin = req.headers.origin || ''
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    // No CORS header = browser blocks the request
    // But server still processes it (for non-browser clients like curl)
    // We return empty origin to block browser-based attacks
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0])
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400') // Cache preflight 24h
  res.setHeader('Vary', 'Origin')
}

module.exports = { setCors }
