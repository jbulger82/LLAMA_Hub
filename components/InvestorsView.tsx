
import React from 'react';
import { useStore } from '../store';

const MetricCard: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <div className="bg-base-200 p-6 rounded-lg border border-base-300 text-center">
        <div className="text-4xl font-extrabold text-primary">{value}</div>
        <div className="text-sm font-semibold text-base-content/70 uppercase tracking-wider mt-2">{label}</div>
    </div>
);

export const InvestorsView: React.FC = () => {
    const setActiveView = useStore(state => state.setActiveView);
    return (
        <div>
            <main className="bg-base-100 py-12 sm:py-16">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl sm:text-5xl font-bold text-base-content">Investor Relations</h1>
                        <p className="mt-4 max-w-3xl mx-auto text-lg text-base-content/80">
                            We are defining the next generation of personal computing with a truly autonomous, private AI platform. Join us in building the future.
                        </p>
                    </div>

                    <div className="max-w-5xl mx-auto">
                        <section className="mb-16">
                            <h2 className="text-3xl font-bold text-center mb-8 text-base-content">The Opportunity</h2>
                            <div className="prose dark:prose-invert max-w-none mx-auto text-base-content/90">
                               <p>The AI market is dominated by closed, cloud-based ecosystems that harvest user data. A significant and growing segment of the market—power users, developers, and the privacy-conscious—is being underserved. LlamaHub is positioned to capture this segment by offering a product that is not just an alternative, but a fundamentally different and superior approach to personal AI.</p>
                               <p>Our business model is built on a freemium platform, with revenue streams from an advanced "Pro" version, a marketplace for specialized tools and agents, and high-margin enterprise licensing for on-premise deployments.</p>
                            </div>
                        </section>

                        <section className="mb-16">
                            <h2 className="text-3xl font-bold text-center mb-8 text-base-content">Key Metrics & Projections</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <MetricCard value="1M+" label="Target Power Users" />
                                <MetricCard value="$XXM" label="Projected ARR (Year 3)" />
                                <MetricCard value="40%" label="Est. Enterprise CAGR" />
                            </div>
                             <p className="text-center text-xs mt-4 text-base-content/60">Note: Figures are illustrative placeholders for demonstration purposes.</p>
                        </section>
                        
                        <section>
                            <h2 className="text-3xl font-bold text-center mb-8 text-base-content">Our Roadmap</h2>
                            <ul className="steps steps-vertical lg:steps-horizontal w-full">
                              <li className="step step-primary">Q4 2024: Public Beta Launch</li>
                              <li className="step step-primary">Q1 2025: LlamaHub Pro Release</li>
                              <li className="step">Q2 2025: Tool & Agent Marketplace</li>
                              <li className="step">Q4 2025: Enterprise Platform Launch</li>
                            </ul>
                        </section>

                        <div className="text-center mt-20">
                            <h2 className="text-2xl font-bold text-base-content">Become a Part of the Journey</h2>
                            <p className="mt-4 max-w-xl mx-auto text-base-content/80">
                                We are currently seeking seed funding to accelerate development, expand our team, and scale our infrastructure. If you share our vision for a private, autonomous AI future, we would love to discuss the opportunity with you.
                            </p>
                            <button onClick={() => setActiveView('contact')} className="btn btn-primary btn-lg mt-8">
                                Contact Our Investor Team
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
