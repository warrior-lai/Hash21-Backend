# Hash21 Backend

**API para firma NIP-57 y verificación de pagos Lightning.**

Serverless en Vercel. Firma zap requests, genera invoices via Lightning Address del artista, y verifica pagos consultando relays Nostr.

🔗 **[hash21-backend.vercel.app](https://hash21-backend.vercel.app)**
🌐 **Frontend:** [hash21.studio](https://hash21.studio) | [Repo](https://github.com/warrior-lai/hash-21)

---

## Endpoints

### `POST /api/zap`

Genera un invoice Lightning para zapear a un artista. Firma el zap request (NIP-57) server-side.

**Request:**
```json
{
  "target": "libertad",
  "amount": 210,
  "message": "Gran obra!"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `target` | string | ID de obra (`libertad`, `the-rabbit`, etc.) o artista (`lai`, `roxy`) |
| `amount` | number | Monto en sats (mínimo 1) |
| `message` | string | Mensaje opcional (max 255 chars) |

**Response (200):**
```json
{
  "invoice": "lnbc2100n1p5...",
  "zapRequest": {
    "kind": 9734,
    "id": "ff69d05e...",
    "pubkey": "56355749...",
    "sig": "f54a948d...",
    "tags": [["relays", "wss://..."], ["amount", "210000"], ["p", "a78a3918..."]],
    "content": "Gran obra!",
    "created_at": 1773876127
  },
  "artist": "lai",
  "lnAddress": "crustycoil11@walletofsatoshi.com"
}
```

**Errores:**
| Status | Error | Causa |
|--------|-------|-------|
| 400 | `Missing target or amount` | Falta parámetro obligatorio |
| 500 | `Server Nostr key not configured` | Variable `HASH21_NOSTR_NSEC` no está en el entorno |
| 500 | `Lightning Address does not support Nostr zaps` | La wallet del artista no soporta NIP-57 |
| 500 | `No invoice received from wallet` | WoS no devolvió invoice (servicio caído o error) |

---

### `GET /api/check`

Verifica si un zap fue pagado consultando relays Nostr por el zap receipt (kind 9735).

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `zapRequestId` | string | ID del zap request (de la respuesta de `/api/zap`) |
| `recipientPubkey` | string | Pubkey Nostr del artista (hex) |
| `since` | number | Timestamp UNIX desde cuándo buscar |

**Response:**
```json
// No pagado
{ "paid": false }

// Pagado
{ "paid": true, "receiptId": "c733f2f2..." }
```

**Cómo funciona:** Conecta via WebSocket a 3 relays Nostr (`relay.damus.io`, `nos.lol`, `relay.nostr.band`), busca eventos kind 9735 que referencien al artista, y verifica que el `description` contenga el zap request ID. Timeout: 5 segundos.

---

### `GET /api/health`

Health check.

**Response:**
```json
{ "status": "ok", "time": "2026-03-18T23:30:45.359Z" }
```

---

## Payment Flow

```
┌─────────┐     POST /api/zap      ┌─────────┐     LNURL-pay      ┌─────┐
│ Frontend │ ──────────────────────→│ Backend │ ──────────────────→│ WoS │
│          │     invoice + zapReq   │ (Vercel)│     invoice        │     │
│          │←──────────────────────│         │←──────────────────│     │
└────┬─────┘                        └─────────┘                    └──┬──┘
     │                                                                │
     │  Muestra QR + invoice                                          │
     │                                                                │
     │         ┌──────┐                                               │
     │         │ User │  Paga con cualquier Lightning wallet          │
     │         └──┬───┘                                               │
     │            │──────────────────────────────────────────────────→│
     │            │                Lightning payment                  │
     │                                                                │
     │                              WoS publica kind 9735             │
     │                              en relays Nostr                   │
     │                                    │                           │
     │  GET /api/check (polling)    ┌─────┴─────┐                    │
     │ ────────────────────────────→│  Nostr    │                    │
     │  { paid: true }              │  Relays   │                    │
     │←────────────────────────────│           │                    │
     │                              └───────────┘                    │
     │  ¡Gracias! ⚡                                                  │
```

## Error Handling

| Escenario | Qué pasa |
|-----------|----------|
| **Backend caído** | Frontend muestra "Error generando invoice. Intentá de nuevo." |
| **WoS no responde** | Backend retorna 500, frontend muestra error con retry |
| **Sin internet** | Fetch falla, frontend muestra error |
| **Pago no detectado en 5 min** | Frontend muestra "Invoice expirado. Intentá de nuevo." |
| **Relays Nostr caídos** | Check endpoint tiene timeout de 5s, retorna `paid: false`, frontend sigue polleando |
| **Pagó pero detección falla** | Botón fallback "✓ Ya pagué" disponible |
| **Monto inválido** | Frontend valida antes de llamar al backend; backend retorna 400 |

## Artistas

Cada artista tiene su Lightning Address. Los sats van directo a su wallet, sin intermediarios.

| Artista | Lightning Address | Nostr Pubkey |
|---------|------------------|--------------|
| Lai⚡️ | `crustycoil11@walletofsatoshi.com` | `a78a3918...` |
| Roxy | (pendiente) | (pendiente) |
| Martu | (pendiente) | (pendiente) |
| Guadis | (pendiente) | (pendiente) |

Para agregar un artista: editar `ARTIST_LN`, `ARTIST_NOSTR`, y `OBRA_ARTIST` en `api/zap.js`.

## Nostr Relays

| Relay | Uso |
|-------|-----|
| `wss://relay.damus.io` | Firma + verificación |
| `wss://relay.nostr.band` | Firma + verificación |
| `wss://nos.lol` | Firma + verificación |
| `wss://relay.primal.net` | Solo en zap request tags |

## Setup

```bash
git clone https://github.com/warrior-lai/Hash21-Backend.git
cd Hash21-Backend
npm install
```

**Variables de entorno:**
```
HASH21_NOSTR_NSEC=nsec1...   # Nostr key de Hash21 para firmar zap requests
```

**Local:**
```bash
vercel dev
```

**Deploy:**
```bash
vercel --prod
# O push a main → auto-deploy
```

## Seguridad

- La nsec de Hash21 está en variables de entorno de Vercel (no en código)
- Fallback hardcodeado solo para desarrollo — reemplazar en producción
- La nsec NO controla fondos — solo firma zap requests
- CORS habilitado (`*`) — restringir a `hash21.studio` en producción
- Los invoices se generan en la wallet del artista — el backend nunca toca los sats

## Licencia

© 2025-2026 Hash21. Todos los derechos reservados.
