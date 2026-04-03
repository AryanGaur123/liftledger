# LiftLedger — Powerlifting Analytics Dashboard

A production-ready web app that connects to your Google Drive, ingests your powerlifting training spreadsheet, and generates detailed analytics for your latest training block.

## What It Does

- **Connects to Google Drive** via OAuth — select any spreadsheet
- **Parses training data** from Google Sheets or XLSX files
- **Normalizes 50+ exercise names** — "CGBP", "close grip bench", "CG Bench" all map to "Close Grip Bench"
- **Auto-detects training blocks** — identifies gaps >3 weeks as block boundaries
- **Calculates weekly metrics per lift:**
  - Total working sets
  - Total reps
  - Total tonnage (weight × reps across all sets)
  - Top weight
- **Visualizes trends** with interactive charts
- **Supports** squat, bench, deadlift, OHP, row, and all common variations

## Example Output

> **Bench Press this week:** 8 sets, 50 reps, 5,000 kg tonnage

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** NextAuth v5 (Auth.js) with Google OAuth
- **API:** Google Drive API + Google Sheets API
- **Charts:** Recharts
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Spreadsheet Parsing:** SheetJS (xlsx)
- **Deployment:** Vercel

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth route handler
│   │   ├── drive/               # Google Drive file listing
│   │   └── analyze/             # Spreadsheet analysis endpoint
│   ├── dashboard/               # Main dashboard page
│   ├── globals.css              # Theme + design tokens
│   ├── layout.tsx               # Root layout with providers
│   └── page.tsx                 # Landing page with sign-in
├── components/
│   ├── dashboard/
│   │   ├── file-picker.tsx      # Google Drive file browser
│   │   ├── kpi-cards.tsx        # Summary metric cards
│   │   ├── volume-chart.tsx     # Stacked bar chart (sets/reps/tonnage)
│   │   ├── tonnage-trend.tsx    # Line chart by lift
│   │   ├── lift-table.tsx       # Sortable breakdown table
│   │   └── weekly-summary.tsx   # Latest week detail cards
│   ├── ui/                      # Reusable UI primitives
│   └── providers.tsx            # Session + theme providers
└── lib/
    ├── auth.ts                  # NextAuth config with Google + Drive scopes
    ├── analytics.ts             # Block detection + metric calculation
    ├── lifts.ts                 # Exercise normalization (50+ patterns)
    ├── parser.ts                # Spreadsheet parsing (Sheets API + XLSX)
    └── utils.ts                 # cn() utility
```

## Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable these APIs:
   - **Google Drive API**
   - **Google Sheets API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://your-app.vercel.app/api/auth/callback/google` (production)
5. Copy the **Client ID** and **Client Secret**

### 2. Environment Variables

Create a `.env.local` file:

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Spreadsheet Format

The parser is robust to various formats. It looks for columns matching:

| Column | Aliases Detected |
|--------|-----------------|
| Date | date, day, training date, session |
| Exercise | exercise, movement, lift, name |
| Sets | sets, set, working sets |
| Reps | reps, rep, repetitions |
| Weight | weight, load, kg, lbs |
| RPE | rpe, rir, intensity |

### Supported Exercises (partial list)

**Squat:** Back Squat, Front Squat, Pause Squat, SSB Squat, Box Squat, Bulgarian Split Squat, Leg Press, Hack Squat

**Bench:** Bench Press, Close Grip Bench, Pause Bench, TNG Bench, Incline Bench, Floor Press, Spoto Press, Larsen Press, DB Bench

**Deadlift:** Conventional, Sumo, Romanian (RDL), Deficit, Pause, Block Pull, Stiff Leg, Trap Bar

**OHP:** Overhead Press, Push Press, DB Shoulder Press

**Row:** Barbell Row, DB Row, Cable Row, T-Bar Row

Unrecognized exercises are categorized as "Accessory" with their name title-cased.

## Calculation Rules

- **Sets** = count of working sets logged
- **Reps** = total reps completed (sets × reps per set)
- **Tonnage** = Σ (weight × reps) across all working sets
- Metrics calculated weekly per lift
- Block totals and trend views aggregated from weekly data

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/liftledger)

### Manual Deploy

1. Push to GitHub
2. Import the repository in [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_SECRET`
   - `AUTH_URL` = your Vercel URL (e.g., `https://liftledger-lilac.vercel.app`)
   - `AUTH_TRUST_HOST` = `true`
4. Deploy

### Post-Deploy

Update Google Cloud Console redirect URIs to include:
```
https://your-app.vercel.app/api/auth/callback/google
```

## Block Detection

The system automatically detects training blocks by analyzing date gaps:
- Groups training sessions by week (Monday start)
- A gap of >21 days between weeks starts a new block
- The latest block is shown by default
- All blocks are available for comparison

## License

MIT
