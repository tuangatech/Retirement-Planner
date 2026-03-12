// src/App.tsx - Main Application Component

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InputsProvider } from '@/contexts/InputsContext';
import { ResultsProvider } from '@/contexts/ResultsContext';
import LandingPage from '@/pages/LandingPage';
import WizardPage from '@/pages/WizardPage';
import ResultsPage from '@/pages/ResultsPage';
import ScenariosPage from './pages/ScenariosPage';
import ComparisonPage from './pages/ComparisonPage';

function App() {
    return (
        <BrowserRouter>
            <InputsProvider>
                <ResultsProvider>
                    <Routes>
                        {/* Landing page at root */}
                        <Route path="/" element={<LandingPage />} />

                        {/* Wizard with step parameter */}
                        <Route path="/wizard/:step" element={<WizardPage />} />

                        {/* Redirect /wizard to /wizard/1 */}
                        <Route path="/wizard" element={<Navigate to="/wizard/1" replace />} />

                        {/* Results page */}
                        <Route path="/results" element={<ResultsPage />} />

                        {/* Catch-all redirect to landing */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                        
                        <Route path="/scenarios" element={<ScenariosPage />} />
                        <Route path="/compare" element={<ComparisonPage />} />
                    </Routes>
                </ResultsProvider>
            </InputsProvider>
        </BrowserRouter>
    );
}

export default App;