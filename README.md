# Secure Track - Technician Fleet Management PWA

A mobile-first Progressive Web App (PWA) built for **Secure Track** field technicians and fleet operations. Enables live logging of GPS tracking device installations, barcode/QR scanning using mobile cameras, offline-first data synchronization, granular inventory depletion, and an Admin Command Portal.

---

## 🌟 Key Features

### 1. Field Technician Installation Logging
- **Customer / Fleet Selection**: Instant dropdown with search and quick inline "+ Add Customer" option.
- **Teltonika Device Tracking**: Dedicated models:
  - `Teltonika FMC920` (Compact 2G/4G Tracker)
  - `Teltonika FMC130` (Advanced LTE Cat 1 with digital inputs)
- **Device IMEI Barcode Scanner**: Integrated camera scanner (`html5-qrcode`) to scan barcodes from device packaging or labels.
- **Dedicated SIM Number Column & Scanner**:
  - Direct SIM number / ICCID input field with dedicated camera barcode scanner button.
  - Dedicated column in installation history tables and Excel export.
  - Inline "+ Add SIM" or edit button directly on history records.
- **Relay Cut-off Toggle**: Option to record 12V/24V immobilizer cut-off relay installations.

### 2. Van Inventory & Automatic Stock Depletion
- Granular tracking per technician van:
  - **FMC920 Units**
  - **FMC130 Units**
  - **SIM Cards**
  - **12V/24V Relays**
- When an installation is submitted, the matching Teltonika model, a SIM card, and a relay (if installed) are automatically decremented.
- Stock adjustment modal with quick increment/decrement buttons.

### 3. Offline-First Resilience (localForage + Firestore)
- When offline or in underground parking/rural areas without signal, installations are securely stored locally via `localForage`.
- Prevents duplicate entries using cryptographic/local uniqueness checks.
- Automatically pushes and synchronizes queued records to Firebase Firestore upon detecting an internet connection.

### 4. Admin Command Portal (`itsecuretrack@gmail.com`)
- **Fleet-Wide Installation History**: Search across all technicians, customers, IMEIs, and SIM numbers.
- **Excel Spreadsheet Export**: Generates `.xlsx` reports with dedicated columns: Date, Customer, Device, IMEI, **SIM Number**, Relay Installed, Technician, Notes.
- **Technician Roster & Inventory Balancing**: View and adjust hardware and SIM stock for every technician van.
- **Customer Accounts Management**:
  - View registered customer fleets and installation counts.
  - **Bulk Customer Import**: Paste raw customer lists or CSV data (`Company Name, Category, Phone`) directly into the portal.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Barcode & QR Scanner**: html5-qrcode
- **Offline Storage**: localForage (IndexedDB fallback)
- **Backend & Database**: Firebase Authentication & Cloud Firestore
- **Reporting**: SheetJS (`xlsx`)

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Start the local development server
npm run dev
```
Open your browser at `http://localhost:3000`.

### Production Build
```bash
npm run build
```
Static production files will be built to `/dist`.

---

## ☁️ Deploying on Free Servers

### Option 1: Vercel (Free Tier)
1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New Project** and select your `secure-track` repository.
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Click **Deploy**.

### Option 2: Netlify (Free Tier)
1. Go to [netlify.com](https://netlify.com) and log in with GitHub.
2. Click **Import from Git** and choose the repository.
3. Build command: `npm run build`.
4. Publish directory: `dist`.
5. Click **Deploy Site**.

### Option 3: Firebase Hosting (Free Tier)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Specify 'dist' as your public directory and configure as a single-page app
npm run build
firebase deploy --only hosting
```

---

## 📱 Installing as a PWA on Mobile
1. Open the app URL in Chrome (Android) or Safari (iOS).
2. Tap **Install Secure Track** banner or use browser menu:
   - **Chrome Android**: Tap the three dots `⋮` → **Install app** or **Add to Home screen**.
   - **Safari iOS**: Tap the Share button `⎋` → **Add to Home Screen**.
3. The app will launch in standalone fullscreen mode with offline support and camera access.
