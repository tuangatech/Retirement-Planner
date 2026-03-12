# Retirement Planning Simulator - Complete Setup & Deployment Guide

## 📋 Prerequisites

- Node.js 18.x or higher (check: `node --version`)
- npm 8.x or higher (check: `npm --version`)
- Git (optional, for version control)
- VS Code (recommended) or any code editor

---

## 🚀 Part 1: Project Setup

### Step 1: Create Project Structure

```bash
# Create project directory
mkdir retirement-simulator
cd retirement-simulator

# Create all required directories
mkdir -p src/types
mkdir -p src/lib
mkdir -p src/contexts
mkdir -p src/components/wizard
mkdir -p src/components/common
mkdir -p src/pages
mkdir -p public
```

### Step 2: Add Configuration Files

Add these files to the **root directory** (`retirement-simulator/`):

1. `package.json` - Dependencies and scripts
2. `tsconfig.json` - TypeScript configuration
3. `tsconfig.node.json` - TypeScript for Node files
4. `vite.config.ts` - Vite bundler configuration
5. `tailwind.config.js` - Tailwind CSS configuration
6. `postcss.config.js` - PostCSS configuration
7. `index.html` - HTML entry point
8. `.gitignore` - Git ignore rules

**Note:** Use the simple `tsconfig.json` without references (easier setup).

### Step 3: Install Dependencies

```bash
# Install all dependencies
npm install

# This installs:
# - React 18.3.1
# - Vite 6.0.3
# - TypeScript 5.7.2
# - Tailwind CSS 3.4.17
# - All other required packages
```

### Step 4: Add Source Files

Add files to the `src/` directory in this order:

**Core Files:**
- `src/main.tsx` - Application entry point
- `src/App.tsx` - Root component
- `src/index.css` - Global styles with Tailwind

**Types & Utilities:**
- `src/types/index.ts` - TypeScript type definitions
- `src/lib/constants.ts` - Default values and constants
- `src/lib/utils.ts` - Utility functions

**State Management:**
- `src/contexts/InputsContext.tsx` - User inputs state
- `src/contexts/ResultsContext.tsx` - Calculation results state

**Components:**
- `src/components/wizard/Step1PersonalInfo.tsx`
- `src/components/wizard/Step2Phases.tsx`
- `src/components/wizard/Step3Accounts.tsx`
- `src/components/wizard/Step4Income.tsx`
- `src/components/wizard/Step5Healthcare.tsx`
- `src/components/wizard/Step6TaxSettings.tsx`
- `src/components/wizard/WizardProgress.tsx`
- `src/components/wizard/WizardNavigation.tsx`
- `src/components/common/Header.tsx`

**Pages:**
- `src/pages/WizardPage.tsx`

**Important:** If using path aliases (`@/`) doesn't work in your editor, use relative imports (`../`) instead.

### Step 5: Verify Setup

```bash
# Check TypeScript compilation (should show 0 errors)
npx tsc --noEmit

# Check project structure
ls -la src/
ls -la src/types/
ls -la src/contexts/
ls -la src/components/wizard/
```

### Step 6: Start Development Server

```bash
npm run dev

# App should open at: http://localhost:5175
# (or your custom port if changed in vite.config.ts)
```

---

## ✅ Verification Checklist

After setup, verify these work:

- [ ] `npm install` completes without errors
- [ ] `npx tsc --noEmit` shows 0 TypeScript errors
- [ ] `npm run dev` starts development server
- [ ] Browser opens to correct port
- [ ] See 6-step wizard with progress indicator
- [ ] Can navigate between steps using Back/Next
- [ ] Basic/Advanced mode toggle works
- [ ] All form inputs are functional
- [ ] No console errors in browser DevTools

---

## 🐛 Troubleshooting

### Issue: "Cannot find module '@/types'"

**Solution 1:** Restart TypeScript server in VS Code
- Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
- Type "restart ts"
- Select "TypeScript: Restart TS Server"

**Solution 2:** Use relative imports instead
- Change `import { ... } from '@/types'` 
- To: `import { ... } from '../types'`

### Issue: "Port 5173 already in use"

**Solution:** Change port in `vite.config.ts`:
```typescript
server: {
  port: 5175, // or any available port
  open: true,
}
```

### Issue: TypeScript errors persist

**Solution:**
```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install

# Restart editor
# Close VS Code completely and reopen
```

### Issue: Vite fails to start

**Solution:**
```bash
# Check Node version
node --version  # Should be 18.x or higher

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Issue: Tailwind styles not loading

**Solution:** Verify `src/index.css` has Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 📦 Part 2: Building for Production

### Build the Application

```bash
# Create production build
npm run build

# Output will be in dist/ folder
# - Optimized and minified
# - Ready for deployment
```

### Preview Production Build Locally

```bash
# Test production build locally
npm run preview

# Opens at http://localhost:4173
```

---

## 🚀 Part 3: Deployment

### Option 1: Vercel (Recommended - Easiest)

**Setup:**
1. Create account at [vercel.com](https://vercel.com)
2. Install Vercel CLI: `npm install -g vercel`
3. Deploy:

```bash
# First time deployment
vercel

# Production deployment
vercel --prod
```

**Auto-deploy from Git:**
1. Push code to GitHub
2. Import project in Vercel dashboard
3. Auto-deploys on every push to main branch

**Build settings (auto-detected):**
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

### Option 2: Netlify

**Setup:**
1. Create account at [netlify.com](https://netlify.com)
2. Install Netlify CLI: `npm install -g netlify-cli`
3. Deploy:

```bash
# Build first
npm run build

# Deploy
netlify deploy

# Production deploy
netlify deploy --prod
```

**Build settings:**
- Build command: `npm run build`
- Publish directory: `dist`

### Option 3: GitHub Pages

**Setup:**
1. Install gh-pages: `npm install -D gh-pages`

2. Add to `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

3. Update `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/retirement-simulator/', // your repo name
  // ... rest of config
});
```

4. Deploy:
```bash
npm run deploy
```

### Option 4: Static Hosting (AWS S3, DigitalOcean, etc.)

```bash
# Build
npm run build

# Upload dist/ folder contents to your hosting provider
# Configure to serve index.html as default document
```

---

## 🔒 Production Best Practices

### Environment Variables

If needed later, create `.env.production`:
```bash
VITE_API_URL=https://api.example.com
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

### Build Optimization

Already configured in Vite:
- ✅ Code splitting
- ✅ Tree shaking
- ✅ Minification
- ✅ Asset optimization
- ✅ Source maps (for debugging)

### Performance Checklist

- [ ] Run `npm run build` without warnings
- [ ] Test production build with `npm run preview`
- [ ] Check bundle size (should be < 500KB)
- [ ] Verify all pages load correctly
- [ ] Test on mobile devices
- [ ] Check browser console for errors

---

## 📊 Project Structure (Final)

```
retirement-simulator/
├── node_modules/           # Dependencies (generated)
├── dist/                   # Production build (generated)
├── public/                 # Static assets
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   └── Header.tsx
│   │   └── wizard/
│   │       ├── Step1PersonalInfo.tsx
│   │       ├── Step2Phases.tsx
│   │       ├── Step3Accounts.tsx
│   │       ├── Step4Income.tsx
│   │       ├── Step5Healthcare.tsx
│   │       ├── Step6TaxSettings.tsx
│   │       ├── WizardProgress.tsx
│   │       └── WizardNavigation.tsx
│   ├── contexts/
│   │   ├── InputsContext.tsx
│   │   └── ResultsContext.tsx
│   ├── lib/
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── pages/
│   │   └── WizardPage.tsx
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ Production build completes without errors
- ✅ All 6 wizard steps work correctly
- ✅ Form inputs save and persist during session
- ✅ Basic/Advanced toggle functions properly
- ✅ No console errors in production
- ✅ App loads in under 3 seconds
- ✅ Responsive on mobile, tablet, desktop
- ✅ Calculate button triggers simulation placeholder

---

## 📝 Next Steps (Future Phases)

**Phase 3:** Monte Carlo Calculation Engine
- Web Worker for calculations
- RMD and tax calculations
- Random return generation

**Phase 4:** Results Dashboard
- Charts and visualizations
- Success probability gauge
- Detailed breakdowns

**Phase 5:** Advanced Features
- Scenario comparison
- Profile management (localStorage)
- PDF export

**Phase 6:** Testing & Optimization
- Unit tests for calculations
- Performance optimization
- Cross-browser testing

---

## 🆘 Getting Help

**Documentation:**
- Vite: https://vitejs.dev
- React: https://react.dev
- Tailwind: https://tailwindcss.com
- TypeScript: https://www.typescriptlang.org

**Common Commands:**
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npx tsc --noEmit   # Check TypeScript errors
```

---

## ✅ You're Done!

Your Retirement Planning Simulator is now:
- ✅ Set up locally
- ✅ Ready for development
- ✅ Deployable to production
- ✅ Fully functional (Phases 1 & 2)

Happy coding! 🚀