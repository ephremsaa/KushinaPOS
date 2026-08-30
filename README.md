# 🍲 kushinaPOS — Modern Ethiopian Restaurant Management System

An all-in-one, offline-first Restaurant POS and management platform built specifically for Ethiopian dining, cafes, lounges, and multi-branch restaurants.

---

## ✨ Key Features

- **⚡ Blazing Fast Touch POS**: Sub-second order taking with table mapping, customizable modifiers, and receipt generation.
- **📶 100% Offline-First Architecture**: Takes orders and prints receipts even during network outages; automatically synchronizes with Supabase Cloud when connectivity restores.
- **💳 Ethiopian Payment Integrations**: Dynamic **Telebirr** QR code generation, **CBE Birr** & CBE Mobile Banking reference verification.
- **🍳 Kitchen Display System (KDS)**: Live color-coded digital order tickets with timers and station filtering (Grill, Bar, Traditional).
- **🪑 Visual Table & Floor Plan Management**: Interactive dining room layouts with real-time status (Available, Dining, Billing).
- **🥩 Recipe & Inventory Stock Control**: Automatically deducts raw ingredients (meat, teff, oil, spices) per order and triggers low-stock alerts.
- **👥 Staff & Shift Management**: 4-digit PIN quick-switching on shared tablets, attendance clock-in tracking, and role-based permissions.
- **📊 Real-time Cloud Analytics**: Daily revenue, peak hours, top-selling dishes, and fiscal tax compliance (15% VAT).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, Zustand, React Query
- **Mobile/Tablet**: Capacitor (Android / iOS / Tablet support), SQLite
- **Backend API**: Node.js, Express, PostgreSQL, JWT Authentication, Bcrypt
- **Database & Cloud**: Supabase PostgreSQL / Cloud Connection Pooling with SSL

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/ephremsaa/KushinaPOS.git
cd KushinaPOS
```

### 2. Install dependencies
```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` in both root and `server/`:

```bash
# Root frontend .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_KEY=your-service-role-key

# server/.env
PORT=3001
DATABASE_URL=postgresql://postgres.your-project:password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
JWT_SECRET=your-secure-jwt-secret-key-32chars
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

### 4. Run Locally
```bash
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Express Backend API**: `http://localhost:3001`
- **API Health Check**: `http://localhost:3001/api/health`

---

## 🔒 Security & Architecture
- Isolated multi-tenant database scoping (`restaurant_id`)
- Role-based access control (`platform_admin`, `restaurant_owner`, `cashier`, `waiter`, `kitchen`)
- Encrypted password hashing with Bcrypt
- Sensitive environment files excluded from version control

---

## 🇪🇹 Built for Ethiopian Restaurants
Proudly designed and engineered for modern Ethiopian dining.
