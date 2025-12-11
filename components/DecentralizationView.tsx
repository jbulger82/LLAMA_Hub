import React from 'react';

// Re-usable components for structure and style
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-16">
        <h2 className="text-3xl font-bold text-base-content mb-8 border-b border-base-300 pb-4">{title}</h2>
        {children}
    </section>
);

const DetailCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="card bg-base-200 shadow-lg border border-base-300 h-full">
        <div className="card-body">
            <h3 className="card-title text-2xl font-bold text-primary flex items-center gap-3">
                {icon}
                <span>{title}</span>
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none text-base-content/90">
                <p>{children}</p>
            </div>
        </div>
    </div>
);

// Icons
const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>;
const ServerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.65H8.228a3.375 3.375 0 00-3.285 2.65l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m15.46 0a4.5 4.5 0 01-6.41 2.122m-2.122-6.41a4.5 4.5 0 00-2.122-6.41m0 0a4.5 4.5 0 00-6.41 2.122m6.41 2.122a4.5 4.5 0 012.122 6.41M6.09 15.75a4.5 4.5 0 016.41-2.122m0 0a4.5 4.5 0 012.122-6.41m-8.532 8.532a4.5 4.5 0 006.41 2.122" /></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
const GlobeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.953 11.953 0 0112 13.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 003 12c0 .778.099 1.533.284 2.253m18.232-4.5A11.953 11.953 0 0012 6c-2.998 0-5.74 1.1-7.843 2.918m15.686 0A8.959 8.959 0 0121 12" /></svg>;

export const DecentralizationView: React.FC = () => {
    return (
        <div>
            <header className="flex-shrink-0 p-6 border-b border-base-300 bg-base-200">
                <div className="text-center">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-base-content tracking-tight">The Decentralization Doctrine</h1>
                    <p className="mt-4 text-lg text-base-content/80 max-w-4xl mx-auto">
                       This is not a feature list; it is a declaration of independence. LlamaHub is architected on a foundational belief: true artificial intelligence must belong to the individual, not the corporation.
                    </p>
                </div>
            </header>
            <main className="py-12 sm:py-16">
                 <div className="container mx-auto px-4 space-y-20">
                    <section>
                         <div className="prose dark:prose-invert max-w-4xl mx-auto text-base-content/90 text-lg">
                            <p>For too long, the narrative has been controlled by centralized entities. They offer convenience in exchange for control, power in exchange for your privacy. They build walled gardens and tell you it's for your own good. We reject this premise entirely. Decentralization is not a technical buzzword; it is a moral imperative. It is the only path forward for an AI that extends human potential without sacrificing human sovereignty.</p>
                            <p className="font-bold">LlamaHub represents this new path. It is a self-hosted, sovereign entity that you own, you control, and you trust, because its operations are transparent and its loyalty is hard-coded to you, the user.</p>
                        </div>
                    </section>

                    <Section title="Pillars of a Sovereign AI">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <DetailCard title="Local-First, Cloud-Optional" icon={<ServerIcon />}>
                                Everything that can be done locally, IS done locally. Your data, your conversations, and your AI's "brain" reside on your hardware. Cloud services are treated as optional, specialized tools to be called upon, not a mandatory foundation. This flips the industry standard on its head, making privacy the default, not an afterthought.
                            </DetailCard>
                            <DetailCard title="Hybrid-Mode Privacy Guarantee" icon={<LockIcon />}>
                                Our commitment to your sovereignty is absolute. Even when you choose a powerful cloud model for complex reasoning, LlamaHub's core memory functions remain strictly local. The Retrieval-Augmented Generation (RAG) system, which gives the AI its long-term memory, performs all embedding and retrieval operations on your machine. Your private knowledge base is never exposed, ensuring your most sensitive data remains firewalled from any third party.
                            </DetailCard>
                             <DetailCard title="Censorship-Resistant by Design" icon={<LinkIcon />}>
                                Centralized services are single points of failure and control. They can be censored, shut down, or altered without your consent. By running on your own hardware, LlamaHub is inherently resistant to these pressures. Your access to your intelligence can never be revoked.
                            </DetailCard>
                            <DetailCard title="Anonymity Through TOR" icon={<GlobeIcon />}>
                                For tasks that require accessing the public internet, LlamaHub can route all backend network requests through the Tor network. This masks your digital footprint, protecting your research and queries from surveillance and ensuring your intellectual curiosity remains private.
                            </DetailCard>
                        </div>
                    </Section>
                    
                    <section className="text-center py-16">
                         <div className="container mx-auto px-4">
                            <div className="prose dark:prose-invert max-w-4xl mx-auto text-base-content/90 text-lg">
                                <blockquote>
                                    <h2 className="text-3xl font-bold text-primary mb-4">A Call to Build the Future</h2>
                                    <p className="!text-xl !italic">We are not just building an application; we are building a movement. A movement for those who believe in the power of the individual, the importance of privacy, and the potential for a truly decentralized digital future. We are seeking partners, developers, and investors who share this vision.</p>
                                    <p className="!text-xl !italic">By supporting LlamaHub, you are not just funding a product. You are investing in a principle: that the most powerful tools of the future should belong to everyone. Join us.</p>
                                </blockquote>
                           </div>
                         </div>
                    </section>
                </div>
            </main>
        </div>
    );
};