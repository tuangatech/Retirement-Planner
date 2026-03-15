// src/components/common/Footer.tsx
// Unified footer component for all pages

import { Heart } from 'lucide-react';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-slate-900 text-slate-400 py-12 mt-auto">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <p className="text-sm max-w-2xl">
                        For educational purposes only. Not financial, tax, legal, or investment advice.
                        Projections use actuarial models with documented assumptions. Consult a qualified professional before making retirement decisions.
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                        <Heart className="w-4 h-4 text-red-400" />
                        <span>Built with transparency • © {currentYear}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}