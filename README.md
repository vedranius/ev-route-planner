# EV Route Planner

Smart route planning for electric vehicles with real-time charger data, combining the best features of ABRP and PlugShare into one fast, responsive application.

## Features

- **Vehicle Database** - 50+ EV models with real specs (Tesla, VW, BMW, Mercedes, Hyundai/Kia, etc.)
- **Smart Route Planning** - Optimal charging stops based on consumption, battery size, SoC, SoH
- **Real-Time Chargers** - 300,000+ charging stations from OpenChargeMap API
- **Charger Filters** - Filter by connector type (CCS, Type 2, CHAdeMO, Tesla)
- **Interactive Map** - OpenStreetMap with Leaflet for full interactivity
- **Location Sharing** - Share real-time location via link, QR code, WhatsApp, Telegram
- **EV Community Chat** - Real-time chat with other EV drivers
- **OVMS Integration** - Connect Open Vehicle Monitoring System for live vehicle data
- **Route Options** - Avoid tolls, highways, ferries; set preferred speed
- **Custom Vehicles** - Manual battery capacity input for modified vehicles
- **Responsive Design** - Works on desktop, tablet, and mobile

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Leaflet + OpenStreetMap
- Firebase (Auth + Realtime Database)
- OpenChargeMap API
- OSRM routing engine
- Nominatim geocoding

## Setup

### 1. Get API Keys

**Firebase:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication (Email/Password + Google)
4. Create a Realtime Database
5. Register a web app and copy config

**OpenChargeMap:**
1. Go to [openchargemap.org](https://openchargemap.org)
2. Register and get a free API key

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your keys
```

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Deploy to GitHub Pages

```bash
npm run build
npm run deploy
```

Or push to `main` branch - GitHub Actions will auto-deploy.

## Configuration

Set these environment variables (in `.env` for local, or GitHub Secrets for deployment):

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime DB URL |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_OCM_API_KEY` | OpenChargeMap API key |

## Project Structure

```
src/
  config/          - Firebase configuration
  types/           - TypeScript type definitions
  data/            - EV vehicle database (50+ models)
  services/        - API services (OpenChargeMap, routing, OVMS)
  context/         - React contexts (Auth, Vehicle)
  components/      - Reusable components (Navbar, VehicleSelector, Layout)
  pages/           - Application pages (Dashboard, Route Plan, Chargers, Chat, etc.)
```

## License

MIT
