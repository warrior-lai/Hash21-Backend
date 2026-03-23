# Hash21 Backend

**API para firma NIP-57, verificación de pagos Lightning, y gestión de contenido.**

Serverless en Vercel + Supabase (PostgreSQL + Storage + Auth). Firma zap requests, genera invoices via Lightning Address del artista, verifica pagos consultando relays Nostr, y provee CRUD para artistas, obras y productos.

🔗 **[hash21-backend.vercel.app](https://hash21-backend.vercel.app)**
🌐 **Frontend:** [hash21.studio](https://hash21.studio) | [Repo](https://github.com/warrior-lai/hash-21)

---

## ✅ Lo que funciona HOY (en producción)

| Feature | Estado | Detalles |
|---------|--------|----------|
| NIP-57 Zap signing | ✅ Live | Firma server-side, detección automática |
| LNURL-pay invoices | ✅ Live | Via Lightning Address del artista |
| WebLN (Alby) | ✅ Live | 1-click payment |
| Payment detection | ✅ Live | Polling Nostr relays (kind 9735) |
| Artists CRUD | ✅ Live | 4 artistas activos |
| Works CRUD | ✅ Live | 6 obras publicadas |
| Products CRUD | ✅ Live | 8 productos en tienda |
| Admin Panel | ✅ Live | Con Supabase Auth login |
| OpenTimestamps | ✅ Live | 2 certificados emitidos |
| Verification page | ✅ Live | hash21.studio/verify |
| 47 automated tests | ✅ Live | 28 frontend + 19 backend |
| Staging environment | ✅ Live | staging.hash21.studio |

## 🔜 Roadmap (próximos meses)

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Artist self-service | Alta | Artistas gestionan su propio perfil y obras |
| Image upload via admin | Alta | Subir fotos desde el panel (ya hay endpoint) |
| Stock management | Media | Control de inventario en la tienda |
| Certification from admin | Media | Emitir certificados on-chain desde el panel |
| Email notifications | Media | Notificar al artista cuando recibe un zap |
| E-commerce completo | Alta | Checkout con detección de pago + envío |
| Analytics dashboard | Baja | Métricas de zaps, visitas, revenue |

---

## Arquitectura

```
┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   Frontend           │     │   Backend            │     │   Supabase   │
│   (GitHub Pages)     │     │   (Vercel)           │     │              │
│                      │     │                      │     │  PostgreSQL  │
│   index.html         │◄───►│   /api/zap           │◄───►│  - artists   │
│   shop/              │     │   /api/check          │     │  - works     │
│   admin/             │     │   /api/artists        │     │  - products  │
│   verify/            │     │   /api/works          │     │  - zaps      │
│   zap.js             │     │   /api/products       │     │              │
│   app.js             │     │   /api/upload         │     │  Storage     │
│   style.css          │     │   /api/health         │     │  - avatars   │
│   lang.js            │     │                      │     │  - works     │
│                      │     │   nostr-tools         │     │  - products  │
└──────────────────────┘     │   @supabase/supabase  │     │              │
                             │   ws (WebSocket)      │     │  Auth        │
┌──────────────────────┐     └──────────┬───────────┘     └──────────────┘
│   Wallet of Satoshi  │               │
│   (Artist's wallet)  │◄──────────────┘
│                      │  LNURL-pay (invoice)
│   crustycoil11@wos   │
└──────────┬───────────┘
           │ Publishes kind 9735
           ▼
┌──────────────────────┐
│   Nostr Relays       │
│   - relay.damus.io   │
│   - nos.lol          │
│   - relay.nostr.band │
└──────────────────────┘
```

## Stack Técnico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Runtime | Vercel Serverless (Node.js) | API endpoints |
| Database | Supabase PostgreSQL | Artists, works, products, zaps |
| Storage | Supabase Storage | Images (avatars, works, products) |
| Auth | Supabase Auth | Admin panel login |
| NIP-57 | nostr-tools v1.17 | Sign zap requests (kind 9734) |
| WebSocket | ws v8.16 | Poll Nostr relays for receipts |
| Payments | LNURL-pay | Invoice generation via Lightning Address |

---

## Endpoints

### `POST /api/zap` — Generate Lightning Invoice (NIP-57)

Genera un invoice Lightning para zapear a un artista. Firma el zap request server-side.

**Request:**
```json
{
  "target": "libertad",
  "amount": 210,
  "message": "Gran obra!"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `target` | string | ✅ | ID de obra o artista |
| `amount` | number | ✅ | Monto en sats (min 1) |
| `message` | string | ❌ | Mensaje opcional (max 255) |

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

**Errors:**

| Status | Error | Causa |
|--------|-------|-------|
| 400 | Missing target or amount | Parámetro obligatorio faltante |
| 500 | Server Nostr key not configured | Env var HASH21_NOSTR_NSEC missing |
| 500 | Lightning Address does not support Nostr zaps | Wallet no soporta NIP-57 |
| 500 | No invoice received from wallet | WoS caído o error |

---

### `GET /api/check` — Verify Payment (Nostr Relay Polling)

Verifica si un zap fue pagado buscando el zap receipt (kind 9735) en relays Nostr.

**Query params:**

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `zapRequestId` | string | ✅ | ID del zap request |
| `recipientPubkey` | string | ✅ | Nostr pubkey del artista (hex) |
| `since` | number | ❌ | Unix timestamp (default: now - 120s) |

**Response:**
```json
{ "paid": false }
// or
{ "paid": true, "receiptId": "c733f2f2..." }
```

**How it works:**
1. Connects via WebSocket to 3 Nostr relays simultaneously
2. Subscribes to kind 9735 events referencing the recipient
3. Checks each receipt's `description` tag for the matching zap request ID
4. Timeout: 5 seconds
5. If any relay returns a match → `paid: true`

---

### `GET /api/artists` — List Artists

**Query params:** `?slug=lai` (optional) `?status=active` (optional)

**Response:** Array of artist objects.

### `POST /api/artists` — Create Artist

```json
{
  "name": "Lai⚡️",
  "slug": "lai",
  "bio_es": "Artista abstracta...",
  "bio_en": "Abstract artist...",
  "motto": "Permanencia para la obra.",
  "lightning_address": "crustycoil11@walletofsatoshi.com",
  "links": {"instagram": "abstract.lai", "twitter": "abstract_lai"},
  "status": "active"
}
```

### `PUT /api/artists` — Update Artist

```json
{ "id": "uuid", "name": "New Name", "status": "inactive" }
```

### `DELETE /api/artists?id=uuid` — Delete Artist

---

### `GET /api/works` — List Works (with artist join)

Returns works with their artist info embedded.

**Query params:** `?artist_id=uuid` `?status=available`

### `POST /api/works` — Create Work

```json
{
  "artist_id": "uuid",
  "title_es": "The Rabbit",
  "title_en": "The Rabbit",
  "technique": "Acrílico y texturas sobre lienzo",
  "image_url": "/img/obra4.jpg",
  "status": "available",
  "type": "physical"
}
```

### `PUT /api/works` — Update Work
### `DELETE /api/works?id=uuid` — Delete Work

---

### `GET /api/products` — List Products

**Query params:** `?status=available`

### `POST /api/products` — Create Product

```json
{
  "name_es": "Sovereign Rest ⚡",
  "name_en": "Sovereign Rest ⚡",
  "label_es": "Objeto de diseño",
  "desc_es": "Descanso soberano...",
  "price_sats": null,
  "image_url": "/img/hashioki-gold.jpg",
  "status": "consult"
}
```

`price_sats: null` = "Precio a consultar"

### `PUT /api/products` — Update Product
### `DELETE /api/products?id=uuid` — Delete Product

---

### `POST /api/upload` — Upload Image to Supabase Storage

```json
{
  "bucket": "works",
  "filename": "obra-nueva.jpg",
  "fileBase64": "/9j/4AAQ...",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "path": "obra-nueva.jpg",
  "url": "https://gxrstqszfzvwvoktsuqg.supabase.co/storage/v1/object/public/works/obra-nueva.jpg"
}
```

### `GET /api/health` — Health Check

```json
{ "status": "ok", "time": "2026-03-23T22:00:00.000Z" }
```

---

## Payment Flow (NIP-57)

```
┌─────────┐     POST /api/zap      ┌─────────┐    LNURL-pay     ┌─────┐
│ Frontend │───────────────────────►│ Backend │───────────────►  │ WoS │
│          │  invoice + zapRequest  │(Vercel) │    invoice       │     │
│          │◄───────────────────────│         │◄─────────────── │     │
└────┬─────┘                        └─────────┘                 └──┬──┘
     │                                                              │
     │ Show QR + invoice                                            │
     │ (or WebLN 1-click)                                           │
     │                                                              │
     │      ┌──────┐                                                │
     │      │ User │ Pays with any Lightning wallet                 │
     │      └──┬───┘                                                │
     │         │────────────────────────────────────────────────────►│
     │                        Lightning payment                     │
     │                                                              │
     │                         WoS publishes kind 9735              │
     │                         on Nostr relays                      │
     │                               │                              │
     │  GET /api/check          ┌────┴──────┐                      │
     │  (polling every 3s)      │  Nostr    │                      │
     │ ─────────────────────►   │  Relays   │                      │
     │  { paid: true }          │           │                      │
     │ ◄─────────────────────   └───────────┘                      │
     │                                                              │
     │  ¡Gracias! ⚡                                                │
```

## OpenTimestamps — Certificación On-Chain

Hash21 certifica obras de arte en la blockchain de Bitcoin usando OpenTimestamps.

**Proceso:**
1. Se calcula el hash SHA-256 del archivo de la obra
2. El hash se envía a OpenTimestamps
3. OTS lo incluye en una transacción de Bitcoin
4. Cuando se mina el bloque, el hash queda grabado permanentemente

**¿Qué certifica?**
- NO certifica autoría
- Certifica que ese archivo existía en ese momento
- Es un **certificado de registro** vinculado a un bloque específico
- Prueba de existencia en el tiempo, permanente e incensurable

**Certificados emitidos:**

| Obra | Bloque | SHA-256 |
|------|--------|---------|
| The Rabbit | #936387 | de7c5e1b...7be44d |
| Libertad | #936793 | (registrado) |

**Verificación pública:** [hash21.studio/verify](https://hash21.studio/verify)

---

## Error Handling

| Escenario | Comportamiento |
|-----------|---------------|
| Backend caído | Frontend muestra "Error generando invoice" |
| WoS no responde | Backend retorna 500, frontend muestra error |
| Sin internet | Fetch falla, frontend muestra error |
| Pago no detectado 5 min | "Invoice expirado. Intentá de nuevo." |
| Relays Nostr caídos | Check retorna `paid: false`, frontend sigue polleando |
| Pagó pero detección falla | Botón fallback "✓ Ya pagué" |
| Monto inválido | Frontend valida; backend retorna 400 |
| Supabase caído | CRUD falla con error; frontend usa datos hardcodeados como fallback |
| Auth inválido | Admin muestra "Email o contraseña incorrectos" |

---

## Database Schema (Supabase)

```sql
-- Artists
CREATE TABLE artists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  bio_es text, bio_en text,
  motto text,
  photo_url text,
  lightning_address text,
  links jsonb DEFAULT '{}',
  status text DEFAULT 'pending',  -- active | pending | inactive
  role text DEFAULT 'artist',     -- admin | artist
  created_at timestamptz DEFAULT now()
);

-- Works
CREATE TABLE works (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id uuid REFERENCES artists(id),
  title_es text NOT NULL, title_en text,
  technique text, dimensions text,
  image_url text,
  status text DEFAULT 'available', -- available | consult | hidden
  type text DEFAULT 'physical',    -- physical | digital
  created_at timestamptz DEFAULT now()
);

-- Products
CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name_es text NOT NULL, name_en text,
  desc_es text, desc_en text,
  label_es text, label_en text,
  price_sats integer,              -- null = price on request
  image_url text,
  status text DEFAULT 'available', -- available | consult | hidden
  created_at timestamptz DEFAULT now()
);

-- Zaps (history)
CREATE TABLE zaps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL,       -- artist | work | product
  target_id text NOT NULL,
  amount_sats integer NOT NULL,
  message text,
  receipt_id text,                 -- Nostr zap receipt ID
  created_at timestamptz DEFAULT now()
);
```

**Storage Buckets:** `avatars`, `works`, `products` (all public)

---

## Artists

| Artista | Lightning Address | Status |
|---------|------------------|--------|
| Lai⚡️ | crustycoil11@walletofsatoshi.com | active |
| Roxy | (pending) | active |
| Martu | (pending) | active |
| Guadis | (pending) | active |

To add an artist: `POST /api/artists` or use the admin panel at `hash21.studio/admin`

---

## Tests

**47 tests total** (28 frontend + 19 backend)

```bash
# Frontend tests (pages, assets, SSL, zap API)
cd hash-21 && ./test.sh

# Backend tests (CRUD, NIP-57, error handling)
cd Hash21-Backend && ./test.sh
```

Backend tests cover:
- Health endpoint
- Zap invoice generation (valid + invalid params)
- NIP-57 signature verification (kind, sig, p tag, relays)
- Payment check (valid + invalid params)
- Artists/Works/Products CRUD (list, create, delete lifecycle)
- Upload error handling

---

## Security

| Concern | Mitigation |
|---------|-----------|
| Nostr private key | Stored in Vercel env var, never in code |
| Supabase service key | Stored in Vercel env var, never in frontend |
| Admin access | Supabase Auth, email/password login |
| CORS | Currently `*`, restrict to hash21.studio in production |
| Fund custody | Zero — invoices generated in artist's wallet, backend never touches sats |
| API keys in frontend | Only anon (read-only) key, never service key |

---

## Setup

```bash
git clone https://github.com/warrior-lai/Hash21-Backend.git
cd Hash21-Backend
npm install
```

**Environment variables:**
```
HASH21_NOSTR_NSEC=nsec1...          # Nostr key for signing zap requests
SUPABASE_URL=https://xxx.supabase.co  # Supabase project URL
SUPABASE_SERVICE_KEY=eyJ...           # Supabase service role key
```

**Local dev:**
```bash
vercel dev
```

**Deploy:**
```bash
vercel --prod
# Or push to main → auto-deploy via GitHub
```

**Run tests:**
```bash
./test.sh
```

---

## Nostr Identity

**Hash21 Nostr pubkey:** `5635574949fc506e10cbd10c06584c7a73e6a29868a606e5e5dd3f77c518fb36`

This key is used exclusively for signing zap requests. It holds no funds and has no other purpose.

**Relays used:**

| Relay | Purpose |
|-------|---------|
| wss://relay.damus.io | Zap receipt detection |
| wss://relay.nostr.band | Zap receipt detection |
| wss://nos.lol | Zap receipt detection |
| wss://relay.primal.net | Listed in zap request tags |

---

## License

MIT License — See [LICENSE](LICENSE)

© 2025-2026 Hash21. All rights reserved.
Las obras de arte son propiedad de sus respectivos artistas.
