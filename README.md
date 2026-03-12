# Retirement Planning Simulator

**The Honest Retirement Calculator**

A privacy-first, Monte Carlo simulation-based retirement planning tool that helps individuals determine if their retirement plan will work. Built with transparency and statistical accuracy in mind, this tool honestly discloses its limitations rather than creating false confidence.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue)](https://reactjs.org/)

---

## 🎯 Product Summary

### Core Concept
**"Tell me what you'll have AT retirement, and I'll tell you if it will last"**

This tool focuses exclusively on the retirement phase—no pre-retirement accumulation modeling. Users input their projected retirement balances, and the simulator models whether those assets will sustain them through retirement.

### Key Features

- **🎲 Monte Carlo Simulation**: Run 1,000-10,000 simulations with randomized market returns
- **📊 Probabilistic Results**: See success rates and outcome distributions (10th/50th/90th percentiles)
- **💰 HSA Integration**: Tax-advantaged healthcare coverage with age 65+ flexibility
- **🏥 Phase-Based Spending**: Model changing expenses across Go-Go, Slow-Go, and No-Go years
- **💳 Multiple Income Sources**: Social Security, pensions, part-time work, rental income
- **🔒 Privacy-First**: No server, no accounts, no tracking—everything runs in your browser
- **📱 Responsive Design**: Works on desktop, tablet, and mobile devices
- **💾 Profile Management**: Save up to 10 scenarios in browser localStorage
- **📈 Rich Visualizations**: Interactive charts with Recharts library
- **⚠️ Honest Limitations**: Mandatory disclosure of what the tool does NOT model

### Target Audience

- Early retirement planners
- FIRE (Financial Independence, Retire Early) community
- Individuals seeking transparent, educational retirement projections
- DIY financial planners who value statistical rigor

---

## 🛠️ Tech Stack

### Core Technologies

- **React 18.2** - UI framework with hooks and context
- **TypeScript 5.3** - Type-safe development
- **Vite 5.0** - Fast build tool and dev server
- **React Router 6** - Client-side routing (Landing → Wizard → Results)

### UI & Styling

- **Tailwind CSS 3.4** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **Lucide React** - Icon library
- **Recharts 2.10** - Chart visualization library

### State Management

- **React Context API** - Global state management (no Redux)
- **React Hook Form** - Form state and validation
- **Zod** - Schema validation

### Performance

- **Web Workers** - Monte Carlo simulations run off main thread
- **React.lazy()** - Code splitting for chart components
- **useMemo** - Cached computations for chart data

### Storage

- **localStorage** - Profile persistence (inputs only, not results)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher (or yarn/pnpm equivalent)
- Modern browser with Web Worker support (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/retirement-planner.git
   cd retirement-planner
   ```

2. **Install dependencies**
   ```bash
   npm install

    # Note: react-router-dom is already in package.json
    # If starting fresh without package.json, install core deps:
    # npm install react-router-dom recharts lucide-react clsx tailwind-merge
    # npm install -D @types/react-router-dom
   ```

3. **Setup shadcn/ui** (if not already configured)
   ```bash
   # Initialize shadcn/ui
   npx shadcn-ui@latest init
   
   # Add required components
   npx shadcn-ui@latest add button
   npx shadcn-ui@latest add card
   npx shadcn-ui@latest add tabs
   npx shadcn-ui@latest add alert
   npx shadcn-ui@latest add dialog
   npx shadcn-ui@latest add input
   npx shadcn-ui@latest add label
   npx shadcn-ui@latest add select
   ```
   
   **Note**: During `shadcn-ui init`, select the following options:
   - Style: **Default**
   - Base color: **Slate**
   - CSS variables: **Yes**

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open browser**
   ```
   http://localhost:5173
   ```

### Available Scripts

```bash
# Development
npm run dev          # Start Vite dev server (hot reload enabled)

# Build
npm run build        # Production build to ./dist
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check

# Testing (optional)
npm run test         # Run Vitest unit tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Generate coverage report
```

---

## 📦 Project Structure

```
retirement-planner/
├── src/
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components (auto-generated)
│   │   ├── common/          # Shared components (Header, ProfileManager)
│   │   ├── landing/         # Landing page components
│   │   ├── wizard/          # 6-step wizard components
│   │   └── results/         # Results dashboard components
│   │
│   ├── contexts/            # React Context providers
│   │   ├── InputsContext.tsx    # User inputs state (~50 fields)
│   │   └── ResultsContext.tsx   # Simulation results + Web Worker
│   │
│   ├── lib/                 # Business logic
│   │   ├── calculations/    # 10 calculation modules (see below)
│   │   ├── storage/         # localStorage profile management
│   │   ├── constants.ts     # Default values, lookup tables
│   │   └── utils.ts         # Helper functions
│   │
│   ├── workers/             # Web Workers
│   │   └── monte-carlo.worker.ts  # Monte Carlo simulation engine
│   │
│   ├── pages/               # Top-level page components
│   │   ├── LandingPage.tsx  # Homepage (/)
│   │   ├── WizardPage.tsx   # Input wizard (/wizard)
│   │   └── ResultsPage.tsx  # Results dashboard (/results)
│   │
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # All interfaces and types
│   │
│   ├── App.tsx              # Root component with routing
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles (Tailwind)
│
├── public/                  # Static assets
├── dist/                    # Production build output (generated)
├── docs/                    # Documentation
│   ├── Requirements.md      # Product requirements (v1.3)
│   ├── System Design.md     # Technical design (v2.1)
│   └── Technical Implementation.md  # Implementation guide
│
├── components.json          # shadcn/ui configuration
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration (Tailwind)
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

---

## 📂 Key Folders & Files

### `/src/components/`
React UI components organized by feature area.

- **`ui/`**: shadcn/ui components (auto-generated via CLI)
  - `button.tsx`, `card.tsx`, `tabs.tsx`, `alert.tsx`, `dialog.tsx`, etc.
  - These are NOT imported from npm—they're copied into your project
  - Fully customizable component code you own
- **`common/`**: Reusable components (Header, ProfileManager)
- **`landing/`**: Landing page with hero section and value proposition
- **`wizard/`**: 6-step input wizard (Personal Info → Phases → Accounts → Income → Healthcare → Tax/Simulation)
- **`results/`**: Results dashboard (Summary, Charts, Table, Assumptions Panel)

### `/src/contexts/`
React Context providers for global state management.

- **`InputsContext.tsx`**: Manages all user inputs (~50-55 fields) with granular update functions
- **`ResultsContext.tsx`**: Manages Monte Carlo simulation execution, progress tracking, and results storage

### `/src/lib/calculations/`
Core calculation engine with 10 independent modules.

```
Module 1:  random.ts            - Seeded RNG, Box-Muller transform
Module 2:  rmd.ts               - Required Minimum Distributions (IRS table)
Module 3:  socialSecurity.ts    - SS benefit adjustments, earnings test
Module 4:  income.ts            - Pensions, work, rental income
Module 5:  expenses.ts          - Phase-based spending, healthcare costs
Module 6:  taxes.ts             - Simplified effective rate, gross-up
Module 7:  withdrawals.ts       - Account withdrawal sequencing, RMD enforcement
Module 8:  yearlyProjection.ts  - Orchestrates all modules for single year
Module 9:  monte-carlo.worker.ts - Runs 1000+ simulations (in /workers/)
Module 10: hsa.ts               - HSA tax-advantaged withdrawal logic
```

**Key Design Principles**:
- Each module is independent with minimal dependencies
- Pure functions (no side effects)
- Extensively commented with examples
- Unit-testable

### `/src/workers/`
Web Workers for CPU-intensive tasks.

- **`monte-carlo.worker.ts`**: Runs Monte Carlo simulations in separate thread to keep UI responsive. Handles 1K-10K simulation runs with progress reporting.

### `/src/types/`
TypeScript type definitions.

- **`index.ts`**: All interfaces (UserInputs, SimulationResults, YearlyProjection, etc.)

### `/src/pages/`
Top-level page components corresponding to routes.

- **`LandingPage.tsx`**: Homepage with value proposition (`/`)
- **`WizardPage.tsx`**: 6-step input wizard (`/wizard`)
- **`ResultsPage.tsx`**: Results dashboard with 4 tabs (`/results`)

---

## 🧮 Calculation Engine Overview

The calculation engine follows a modular, functional design:

```
User Inputs
    ↓
Module 1: Generate random returns (Box-Muller)
    ↓
Module 2-7: Calculate income, expenses, taxes, withdrawals
    ↓
Module 8: Assemble yearly projection
    ↓
Module 9: Run Monte Carlo simulation (1000+ times)
    ↓
Results: Success rate, percentiles, full projections
```

**Performance**: 
- 1,000 runs: ~2 seconds
- 5,000 runs: ~5 seconds
- 10,000 runs: ~10 seconds

**Accuracy**: Uses seeded pseudo-random number generator (Mulberry32) for reproducible results.

---

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in `./dist/` with:
- Minified JavaScript and CSS
- Code splitting (lazy-loaded charts)
- Tree-shaking (removes unused code)
- Source maps for debugging

**Output size**: 
- Initial bundle: ~750KB (gzipped: ~200KB)
- Lazy-loaded charts: ~300KB

## 🔧 Configuration

### Environment Variables

This project does not require any environment variables or API keys. Everything runs client-side.

### Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Import alias for cleaner paths
    },
  },
  worker: {
    format: 'es',  // CRITICAL: Required for Web Worker imports
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts'],
        },
      },
    },
  },
})
```

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "WebWorker"],
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]  // Path alias configuration
    }
  }
}
```

### Tailwind Configuration (`tailwind.config.js`)

```javascript
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom colors for success rates, charts, etc.
      },
    },
  },
  plugins: [],
}
```

### shadcn/ui Configuration (`components.json`)

Created automatically when running `npx shadcn-ui@latest init`:

```json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

---

## 📊 Data Storage

### localStorage Schema

```typescript
// Key: 'retirement-planner-profiles'
interface StoredData {
  profiles: SavedProfile[];  // Max 10 profiles
}

interface SavedProfile {
  id: string;              // UUID
  name: string;            // User-provided name
  createdAt: number;       // Timestamp
  updatedAt: number;       // Timestamp
  inputs: UserInputs;      // ONLY inputs, NOT results (~50KB)
}
```

**Important**: 
- Results are NOT stored (too large: 5-10MB)
- Results are recalculated on every load (2-10 seconds)
- Max 10 profiles per browser (~500KB-1MB total)

### Privacy

- **No server**: All calculations happen in browser
- **No accounts**: No user authentication required
- **No tracking**: No analytics or user data collection
- **No cookies**: Uses only localStorage for profiles

⚠️ **Warning**: Do not use on shared/public computers. Anyone with access to the browser can view saved profiles.

---

## 📖 Documentation

- **[Requirements.md](docs/Requirements.md)**: Product requirements specification (v1.3)
- **[System Design.md](docs/System Design.md)**: Technical architecture and design (v2.1)
- **[Technical Implementation.md](docs/Technical Implementation.md)**: Implementation guide with code examples

### Key Design Decisions

1. **No pre-retirement modeling**: Focuses only on retirement phase to reduce complexity
2. **Simplified tax modeling**: Uses effective rate instead of actual brackets for usability
3. **Mandatory assumptions panel**: Honest disclosure of limitations builds trust
4. **localStorage only**: No cloud sync keeps project simple and privacy-focused
5. **Web Workers for calculations**: Keeps UI responsive during 2-10 second simulations

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Code Style

- Follow existing TypeScript patterns
- Use functional components with hooks (no class components)
- Add JSDoc comments for complex functions
- Keep functions small and single-purpose
- Write unit tests for calculation logic

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📧 Contact

For questions, suggestions, or bug reports:

- **GitHub Issues**: [Create an issue](https://github.com/yourusername/retirement-planner/issues)
- **Email**: your.email@example.com
- **Website**: https://yourwebsite.com

---

**Made with ❤️ for the FIRE community**