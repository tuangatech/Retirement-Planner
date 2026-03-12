// src/components/common/Footer.tsx
// Unified footer component for all pages (Wizard, Results, Scenarios, Comparison)

import { Heart, Shield, Github, Mail } from 'lucide-react';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-slate-900 text-slate-400 py-12 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Column 1: About */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">About This Tool</h3>
                        <p className="text-sm leading-relaxed">
                            A free, privacy-first retirement planning calculator built for early retirees and FIRE planners.
                            All calculations run in your browser—your data never leaves your device.
                        </p>
                    </div>

                    {/* Column 2: Key Features */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Key Features</h3>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-teal-400" />
                                <span>100% privacy - no data collection</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-teal-400" />
                                <span>Monte Carlo simulations (1K-10K runs)</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-teal-400" />
                                <span>HSA, RMDs, Medicare modeling</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-teal-400" />
                                <span>Save & compare up to 5 scenarios</span>
                            </li>
                        </ul>
                    </div>

                    {/* Column 3: Contact & Links */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Get in Touch</h3>
                        <div className="space-y-3 text-sm">
                            <a
                                href="https://github.com/yourusername/retirement-calculator"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 hover:text-teal-400 transition-colors"
                            >
                                <Github className="w-4 h-4" />
                                <span>View on GitHub</span>
                            </a>
                            <a
                                href="mailto:feedback@retirementplanner.com"
                                className="flex items-center gap-2 hover:text-teal-400 transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                <span>Send Feedback</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-slate-800">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        {/* Copyright & Love */}
                        <div className="flex items-center gap-2 text-sm">
                            <Heart className="w-4 h-4 text-red-400" />
                            <span>Built with transparency and honesty • © {currentYear}</span>
                        </div>

                        {/* Disclaimer */}
                        <div className="text-xs text-center md:text-right max-w-2xl">
                            Educational projections only. Not financial, tax, legal, or investment advice.
                            Consult qualified professionals before making retirement decisions.
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}