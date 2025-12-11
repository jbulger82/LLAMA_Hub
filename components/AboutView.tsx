
import React from 'react';

// Re-usable components for structure and style, similar to LocalLLMView
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-16">
        <h2 className="text-3xl font-bold text-base-content mb-8 border-b border-base-300 pb-4">{title}</h2>
        {children}
    </section>
);

const DetailCard: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="card bg-base-200 shadow-lg border border-base-300 h-full">
        <div className="card-body">
            <h3 className="card-title text-2xl font-bold text-primary flex items-center gap-3">
                {icon}
                <span>{title}</span>
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none text-base-content/90">
                {children}
            </div>
        </div>
    </div>
);

// Icons for the cards
const SovereigntyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
const BoltSlashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243a3 3 0 01-4.243-4.243" /></svg>;
const MultiAgentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.952a4.5 4.5 0 01-6.364-6.364v-.007A4.5 4.5 0 0110.5 9h.008a4.5 4.5 0 016.364 6.364v.007a4.5 4.5 0 01-6.364 6.364zM12 12a3 3 0 100-6 3 3 0 000 6z" /></svg>;
const ResourceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5c0 .878-.203 1.707-.586 2.457l-1.339 2.678-3.63-1.815.34-1.625a.75.75 0 011.45.31l-.15 1.587 2.12-1.06a6.72 6.72 0 001.12-2.88M21 7.5c-1.383 0-2.653.535-3.597 1.403M4.08 11.543l1.34 2.679 3.63-1.815-.34-1.625a.75.75 0 00-1.45.31l.15 1.587-2.12-1.06a6.72 6.72 0 01-1.12-2.88M3 7.5c1.383 0 2.653.535 3.597 1.403m13.24 6.758l1.113 2.226a3.75 3.75 0 01-5.303 5.303l-2.226-1.113a3.75 3.75 0 015.303-5.303zM3.868 18.305l-1.113 2.226a3.75 3.75 0 005.303 5.303l2.226-1.113a3.75 3.75 0 00-5.303-5.303z" /></svg>;

const EvolutionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18 3.185-3.18-3.185m0 0-3.18 3.183m3.18-3.185-3.18-3.185" /></svg>;
const CreationIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.472-2.472a3.375 3.375 0 00-4.773-4.773L6.75 21A2.652 2.652 0 009 21h1.42z" /></svg>;
const DominionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>;

const CodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V5.75A2.25 2.25 0 0018 3.5H6A2.25 2.25 0 003.75 5.75v12.25A2.25 2.25 0 006 20.25z" /></svg>;
const CyberIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.602-3.751m-.223-1.024a12.023 12.023 0 00-3.352-2.149l-2.022-1.012a2.25 2.25 0 00-2.24 0l-2.022 1.012A12.023 12.023 0 005.15 4.976m11.698-.016A11.959 11.959 0 0012 2.75a11.959 11.959 0 00-3.848.91m11.698-.016L12.5 6h-1M4.5 9.75v1.074c0 .54.18.983.472 1.348l.49.563a1.5 1.5 0 002.083.332l1.458-.972a4.5 4.5 0 015.01 0l1.458.972a1.5 1.5 0 002.083-.332l.49-.563a2.47 2.47 0 00.472-1.348V9.75" /></svg>;
const FinanceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" /></svg>;
const CreativeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>;
const EcommIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h2.64m-13.78 0h3.75V9.75c0-1.036.84-1.875 1.875-1.875h3.75c1.036 0 1.875.84 1.875 1.875v3.75m-13.5 0V9A2.25 2.25 0 014.5 6.75h15A2.25 2.25 0 0121.75 9v4.5m-13.5 0V6.75" /></svg>;
const KnowledgeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>;

const ToolIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.5 4.5H6.75a4.5 4.5 0 01-4.5-4.5V6.75m19.5 0A2.625 2.625 0 0019.125 4.5H4.875A2.625 2.625 0 002.25 6.75m19.5 0v.25M6.75 12V6.75m10.5 5.25h-5.25" /></svg>;
const PartnerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.31h5.414c.495 0 .701.659.336.986l-4.114 2.985a.562.562 0 00-.182.621l2.125 5.111a.563.563 0 01-.812.622l-4.114-2.985a.563.563 0 00-.576 0l-4.114 2.985a.563.563 0 01-.812-.622l2.125-5.111a.563.563 0 00-.182-.621l-4.114-2.985a.563.563 0 01.336-.986h5.414a.563.563 0 00.475-.31l2.125-5.111z" /></svg>;
const ConfidanteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;

export const AboutView: React.FC = () => {

    return (

        <div>

            <header className="flex-shrink-0 p-6 border-b border-base-300 bg-base-200">

                <div className="text-center">

                    <h1 className="text-4xl sm:text-5xl font-extrabold text-base-content tracking-tight">About LlamaHub</h1>

                </div>

            </header>

            <main className="py-12 sm:py-16">

                 <div className="container mx-auto px-4 space-y-20">

                    <section>

                         <div className="prose dark:prose-invert max-w-4xl mx-auto text-base-content/90 text-lg">

                            <p>LlamaHub is a locally-run, privacy-first AI assistant built for power users. It gives you a serious control panel for working with local LLMs, tools, and your own data—without handing everything to some remote server.</p>

                            <p>The core idea behind LlamaHub is decentralization and a local-first mindset: you own the models, you own the data, you own the logs. You’re the admin here, and the system is designed to adapt to your workflow, not the other way around.</p>

                            <p>LlamaHub is more than “just a chatbot.” It can plug into your tools and environment for things like:</p>

                            <ul>

                                <li>persistent knowledge (RAG over your own files),</li>

                                <li>web access when you choose to enable it,</li>

                                <li>code generation and analysis,</li>

                                <li>multi-agent / deep research workflows,</li>

                                <li>and an an expanding set of integrations.</li>

                            </ul>

                            <p>I’m actively looking for sponsors and collaborators to help push the platform further. If you’re interested in contributing, integrating it into your own stack, or just want to talk ideas, reach out:</p>

                            <p>Created and maintained by: Jeff Bulger<br/>Contact: admin@jeffbulger.dev</p>

                        </div>

                    </section>

                </div>

            </main>

        </div>

    );

};
