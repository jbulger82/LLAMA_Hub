
import React from 'react';
import { useStore } from '../store';

const ProposalCard: React.FC<{ title: string; children: React.ReactNode; cta: string }> = ({ title, children, cta }) => {
    const setActiveView = useStore(state => state.setActiveView);
    return (
        <div className="card bg-base-200 shadow-xl border border-base-300 transform transition-transform hover:-translate-y-1">
            <div className="card-body">
                <h2 className="card-title text-2xl font-bold text-primary">{title}</h2>
                <p className="text-base-content/80 mt-2 mb-4">{children}</p>
                <div className="card-actions justify-end">
                    <button onClick={() => setActiveView('contact')} className="btn btn-primary">{cta}</button>
                </div>
            </div>
        </div>
    );
};

export const ProposalsView: React.FC = () => {
    return (
        <div>
            <main className="bg-base-100 py-12 sm:py-16">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl sm:text-5xl font-bold text-base-content">Partner with LlamaHub</h1>
                        <p className="mt-4 max-w-3xl mx-auto text-lg text-base-content/80">
                            We are building an open ecosystem around autonomous AI. We believe collaboration is key to accelerating innovation and creating value for users everywhere.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                        <ProposalCard title="Technology & Integration Partners" cta="Discuss Integration">
                            Is your service, tool, or platform a perfect fit for an AI assistant? We are actively seeking partners to expand LlamaHub's capabilities. Integrate your API to give users direct control over your product through a natural language interface.
                        </ProposalCard>
                        <ProposalCard title="Business & Enterprise Solutions" cta="Explore Solutions">
                            Leverage the power and privacy of the LlamaHub platform for your business. We are open to proposals for custom deployments, white-labeling, and developing specialized, on-premise AI solutions for enterprise needs.
                        </ProposalCard>
                        <ProposalCard title="Open Source Collaboration" cta="View our Roadmap">
                            The future of LlamaHub is open. We are planning to open-source key components of the platform to foster community development. If you are a developer passionate about local-first AI and privacy, we want to hear from you.
                        </ProposalCard>
                        <ProposalCard title="Research & Academia" cta="Propose a Study">
                            LlamaHub's unique architecture presents new opportunities for research in human-computer interaction, multi-agent systems, and private AI. We welcome proposals for academic collaboration and studies.
                        </ProposalCard>
                    </div>

                    <div className="max-w-4xl mx-auto mt-20 text-center">
                        <h2 className="text-3xl font-bold text-base-content">Why Partner With Us?</h2>
                        <ul className="list-disc text-left text-base-content/80 mt-6 space-y-2 inline-block">
                            <li>Access a platform built for privacy and user control, a key differentiator in today's market.</li>
                            <li>Integrate with a flexible, tool-centric architecture designed for extensibility.</li>
                            <li>Reach a growing audience of power users, developers, and privacy-conscious individuals.</li>
                            <li>Collaborate with a team dedicated to pushing the boundaries of autonomous AI.</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
};
