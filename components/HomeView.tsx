
import React from 'react';
import { useStore } from '../store';

const FeatureHighlight: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="flex flex-col items-center text-center">
        <div className="flex-shrink-0 mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary">
                <span className="text-3xl">{icon}</span>
            </div>
        </div>
        <h3 className="text-xl font-semibold text-base-content mb-2">{title}</h3>
        <p className="text-base-content/80 text-sm leading-relaxed">{children}</p>
    </div>
);

export const HomeView: React.FC = () => {
    const setActiveView = useStore(state => state.setActiveView);

    return (
        <div>
            {/* Hero Section */}
            <section className="py-20 sm:py-28 md:py-32 bg-base-200/50">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-base-content tracking-tight">
                        Francine: Your Fully Autonomous AI Assistant
                    </h1>
                    <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-base-content/80">
                        Experience unparalleled control with a local-first AI designed for privacy, power, and limitless customization.
                    </p>
                    <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
                        <button onClick={() => setActiveView('investors')} className="btn btn-primary btn-lg shadow-lg">
                            Back Our Campaign
                        </button>
                        <button onClick={() => setActiveView('features')} className="btn btn-ghost btn-lg">
                            Explore Features
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Highlight Section */}
            <section className="py-20 sm:py-24">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-bold text-base-content">The Future of Personal AI is Here</h2>
                        <p className="mt-4 max-w-3xl mx-auto text-base-content/70">
                            Francine isn't just another chatbot. It's a powerful, extensible platform built on three core principles.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <FeatureHighlight icon="🛡️" title="Unyielding Privacy">
                            With a local-first architecture, your chats, files, and knowledge base stay on your machine. You control your data, always.
                        </FeatureHighlight>
                        <FeatureHighlight icon="🛠️" title="Powerful Tooling">
                            From web access and code interpretation to multi-agent deep research, LlamaHub provides a suite of tools to accomplish any task.
                        </FeatureHighlight>
                        <FeatureHighlight icon="⚙️" title="Radical Customization">
                            Fine-tune every aspect of your AI, from the system prompt and UI theme to detailed model parameters for local inference.
                        </FeatureHighlight>
                    </div>
                </div>
            </section>
            
            {/* Call to Action Section */}
            <section className="py-20 sm:py-24 bg-base-200">
                 <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-base-content">Ready to Shape the Future?</h2>
                    <p className="mt-4 max-w-2xl mx-auto text-base-content/80">
                       Become an early supporter and help us build the next generation of personal AI.
                    </p>
                    <div className="mt-8">
                        <button onClick={() => setActiveView('investors')} className="btn btn-primary btn-lg shadow-lg">
                            Support the Vision
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};
