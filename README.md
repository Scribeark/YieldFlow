# Agri-Data Hub

> **Unified Agricultural Information Infrastructure**
>
> A Master's degree-level full-stack web application connecting farmers, logistics carriers (3PL), and market administrators with an integrated Data Analytics Engine.

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, TypeScript) |
| **Styling** | Tailwind CSS v4 |
| **Database** | PostgreSQL (Supabase) |
| **Auth** | Supabase Auth (Email/Password) |
| **State** | Zustand |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **PWA** | @ducanh2912/next-pwa |

---

## 📁 Project Structure

```
agri-data-hub/
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── route.ts          # USSD webhook endpoint
│   ├── dashboard/
│   │   ├── admin/
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx      # BI Analytics Dashboard
│   │   │   └── page.tsx          # Admin Dashboard
│   │   ├── carrier/
│   │   │   └── page.tsx          # Carrier Dashboard
│   │   └── farmer/
│   │       └── page.tsx          # Farmer Dashboard
│   ├── login/
│   │   └── page.tsx              # Login/Signup Page
│   ├── offline/
│   │   └── page.tsx              # PWA Offline Fallback
│   ├── globals.css               # Design System
│   ├── layout.tsx                # Root Layout
│   └── page.tsx                  # Landing Page
├── components/
│   ├── admin/
│   │   ├── LogisticsTable.tsx    # Global logistics overview
│   │   └── UserGrid.tsx          # Platform user management
│   ├── carrier/
│   │   ├── AvailableHarvests.tsx # Pending harvest board
│   │   └── FleetBookings.tsx     # Carrier fleet management
│   ├── farmer/
│   │   ├── ActiveLogs.tsx        # Real-time harvest logs
│   │   ├── HarvestForm.tsx       # Harvest entry form
│   │   └── IoTReadout.tsx        # IoT sensor readout
│   ├── layout/
│   │   └── NavigationShell.tsx   # Responsive sidebar/nav
│   ├── providers/
│   │   └── AuthProvider.tsx      # Auth initialization
│   ├── ui/
│   │   ├── LoadingSkeleton.tsx   # Loading skeleton components
│   │   └── OfflineBanner.tsx     # Offline status banner
│   └── ErrorBoundary.tsx         # Error boundary wrapper
├── hooks/
│   └── useNetworkStatus.ts      # Online/offline detection
├── lib/
│   ├── analytics.ts             # Data aggregation service
│   ├── supabaseClient.ts        # Supabase client singleton
│   └── types.ts                 # Shared TypeScript types
├── store/
│   └── authStore.ts             # Zustand auth store
├── supabase/
│   └── schema.sql               # Database schema + RLS
├── middleware.ts                 # Route protection & RBAC
├── public/
│   └── manifest.json            # PWA manifest
├── .env.local                   # Environment variables
└── next.config.ts               # Next.js + PWA config
```

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase project (already configured)

### 1. Install Dependencies

```bash
cd agri-data-hub
npm install
```

### 2. Set Up Database

Copy the contents of `supabase/schema.sql` and run it in your **Supabase SQL Editor**. This will create:
- All tables with proper relationships
- Custom enum types
- Row-Level Security (RLS) policies
- Realtime subscriptions
- Auto-trigger for user profile creation on signup

### 3. Configure Environment

The `.env.local` file is pre-configured. Update `WEBHOOK_API_SECRET` with your own secret for the USSD webhook.

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📊 Supabase Tables

| Table | Description |
|-------|------------|
| `users` | User profiles with roles (farmer/carrier/admin) |
| `harvest_logs` | Crop harvest records with status tracking |
| `logistics_bookings` | Carrier-harvest assignment and logistics tracking |
| `iot_telemetry_logs` | IoT sensor readings (soil moisture, temperature) |

### Row-Level Security (RLS) Summary

| Role | `users` | `harvest_logs` | `logistics_bookings` | `iot_telemetry_logs` |
|------|---------|----------------|----------------------|----------------------|
| **Farmer** | Own profile | Own records (CRUD) | View own harvest bookings | Own telemetry (CRUD) |
| **Carrier** | Own profile | View pending + matched | Own bookings (CRUD) | — |
| **Admin** | All users | All records | All bookings | All telemetry |

---

## 🔗 API Endpoints

### Webhook (USSD Gateway)
- **POST** `/api/webhook`
  - Headers: `x-api-secret: <WEBHOOK_API_SECRET>`
  - Body: `{ "phone_number": "+234...", "crop_type": "Maize", "quantity": 500 }`
  - Response: `{ "status": "success", "message": "Harvest logged via API" }`

---

## 📱 PWA Support

The application is configured as a Progressive Web App:
- **Installable** on mobile and desktop
- **Offline fallback** page for poor connectivity
- **Network status banner** when offline
- **Service Worker** caching for static assets

---

## 👥 User Roles

1. **Farmer**: Log harvests, view real-time status, monitor IoT sensors
2. **Carrier**: Browse available loads, accept shipments, manage fleet
3. **Admin**: Full system oversight, user management, BI analytics

---

## 📈 Analytics Engine

The BI dashboard (`/dashboard/admin/analytics`) provides:
- **Volume Trends**: 30-day harvest volume line chart
- **Status Distribution**: Supply chain bottleneck analysis pie chart
- **Environmental Averages**: Soil moisture and temperature bar chart by location

---

## License

This project was developed as part of a Master's degree research at MIT.
