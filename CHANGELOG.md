# Changelog

## [1.0.0] - 2026-07-19

### Initial Release

#### Core Features
- **Vehicle Database**: 50+ EV models with real specifications (Tesla, VW, BMW, Mercedes, Hyundai/Kia, BYD, Renault, Volvo, Polestar, Xiaomi, etc.)
- **Smart Route Planning**: Optimal charging stop calculation based on vehicle consumption, battery capacity, SoC, and SoH
- **Real-Time Charger Data**: 300,000+ charging stations via OpenChargeMap API
- **Interactive Maps**: Leaflet + OpenStreetMap with full interactivity
- **Charger Filtering**: Filter by connector type (CCS, Type 2, CHAdeMO, Tesla)
- **Route Options**: Avoid tolls, highways, ferries; set preferred speed for consumption calculation
- **Custom Battery Support**: Manual battery capacity input for modified vehicles

#### Authentication
- Email/password registration with verification
- Google sign-in integration
- Firebase Authentication backend
- Profile management

#### Real-Time Features
- **Location Sharing**: Share real-time GPS location via link, QR code, WhatsApp, Telegram
- **EV Community Chat**: Real-time chat between EV drivers using Firebase Realtime Database
- **OVMS Integration**: Connect Open Vehicle Monitoring System for live vehicle data (SoC, SoH, speed, range, charging status)

#### Navigation & Routing
- OSRM routing engine for optimal route calculation
- Preferred speed input for accurate consumption estimates
- Charging curve simulation for realistic charge time estimates
- Arrival/departure SoC calculations for each charging stop

#### Technical
- React 19 + TypeScript + Vite
- Tailwind CSS v4 responsive design
- Firebase (Auth + Realtime Database)
- GitHub Actions CI/CD for GitHub Pages
- HashRouter for static hosting compatibility
- Mobile-first responsive design

#### APIs Used
- OpenChargeMap API v3 (charger data)
- OSRM (routing)
- Nominatim (geocoding)
- Firebase (auth, database, realtime chat)
- OpenStreetMap tiles (maps)
