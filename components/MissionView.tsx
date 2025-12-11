
import React from 'react';

const MissionPillar: React.FC<{ icon: string, title: string, children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="card bg-base-200 shadow-xl border border-base-300">
        <div className="card-body items-center text-center">
            <span className="text-5xl mb-4">{icon}</span>
            <h2 className="card-title text-2xl font-bold text-primary">{title}</h2>
            <p className="text-base-content/80">{children}</p>
        </div>
    </div>
);


export const MissionView: React.FC = () => {
    return (
        <div>
            <main className="bg-base-100 py-12 sm:py-16">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl sm:text-5xl font-bold text-base-content">Our Mission</h1>
                        <p className="mt-4 max-w-3xl mx-auto text-lg text-base-content/80">
                            To build a future where powerful artificial intelligence is a personal, private, and democratized tool that extends human capability without compromising individual sovereignty.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <MissionPillar icon="🛡️" title="Unyielding Privacy">
                            We believe your data is yours alone. Our local-first philosophy ensures that your conversations, creations, and knowledge remain on your device. We don't want your data; we want to empower you with tools that protect it.
                        </MissionPillar>
                        <MissionPillar icon="🗽" title="Radical Autonomy">
                            True assistance comes without strings attached. LlamaHub is designed to be fully autonomous, free from reliance on a single corporate cloud. You choose your AI provider, you control the parameters, and you own the platform.
                        </MissionPillar>
                        <MissionPillar icon="🚀" title="Limitless Extensibility">
                            An AI assistant should grow with you. We are committed to building an open, extensible platform with powerful tools, robust integrations, and deep customization. Your imagination should be the only limit to what you can achieve.
                        </MissionPillar>
                    </div>

                    <div className="max-w-4xl mx-auto mt-20">
                        <h2 className="text-3xl font-bold text-center mb-6 text-base-content">The Vision for Tomorrow</h2>
                        <div className="prose dark:prose-invert max-w-none mx-auto text-base-content/90 text-center">
                            <p>
                               We envision a world where every individual can have a trusted AI companion—a co-pilot for their digital life that enhances creativity, automates tedious tasks, and provides instant access to information, all while operating as a secure extension of their own mind. LlamaHub is the first step towards this decentralized, user-centric future.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
