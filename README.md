# Risk Scoring App

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Google Maps Geocoding Setup (important)

If address lookup fails with `REQUEST_DENIED` or `The provided API key is invalid`, the key configuration is usually the issue.

### 1) Create/choose a Google Cloud project
- Go to Google Cloud Console.
- Ensure **Billing** is enabled for the project.

### 2) Enable required API
- Enable **Geocoding API** for the project.

### 3) Create two keys (recommended)

#### Server key (for backend route `/api/geocode`)
- Create an API key intended for server usage.
- Restrict by **API restrictions** to `Geocoding API`.
- For application restrictions, use **IP restrictions** (or no app restriction while testing).
- Put this in env as:

```bash
GOOGLE_MAPS_API_KEY=your_server_key
```

#### Browser key (optional fallback)
- Create another API key for browser usage.
- Restrict by **HTTP referrers** (e.g. `http://localhost:3000/*`, your production domain).
- Restrict API usage to `Maps JavaScript API` + `Geocoding API`.
- Put this in env as:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_browser_key
```

### 4) Create `.env.local`

```bash
GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
```

Then restart the dev server.

### 5) Validate the key directly

Test the server key from terminal:

```bash
curl "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=$GOOGLE_MAPS_API_KEY"
```

Expected result should include `"status" : "OK"` and at least one result.

If status is `REQUEST_DENIED`:
- wrong key
- Geocoding API not enabled
- billing not active
- key restriction type does not match usage (e.g., referrer-restricted key used server-side)

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run seed
npm run geocode-campuses
```
