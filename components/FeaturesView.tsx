import React from 'react';

// --- Reusable Components (matching other pages) ---
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-16">
        <h2 className="text-3xl font-bold text-base-content mb-8 border-b border-base-300 pb-4">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children}
        </div>
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

// --- SVG Icons for Cards ---
const DualAiIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18 3.185-3.18-3.185m0 0-3.18 3.183m3.18-3.185-3.18-3.185" /></svg>;
const ConversationIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.72.372a3.75 3.75 0 01-3.696-3.696V12.5a3.75 3.75 0 013.75-3.75h5.25zM12 15v-3.75A3.75 3.75 0 008.25 7.5h-1.5a3.75 3.75 0 00-3.75 3.75v3.75m0 0h1.5m-1.5 0v-3.75m0 3.75a3.75 3.75 0 01-3.75-3.75H4.5" /></svg>;
const MultimodalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" /></svg>;
const VoiceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 016 0v8.25a3 3 0 01-3 3z" /></svg>;
const RagIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>;
const MagicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>;
const ResearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const WebIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.953 11.953 0 0112 13.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 003 12c0 .778.099 1.533.284 2.253m18.232-4.5A11.953 11.953 0 0012 6c-2.998 0-5.74 1.1-7.843 2.918m15.686 0A8.959 8.959 0 0121 12" /></svg>;
const CodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V5.75A2.25 2.25 0 0018 3.5H6A2.25 2.25 0 003.75 5.75v12.25A2.25 2.25 0 006 20.25z" /></svg>;
const ShieldCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.602-3.751m-.223-1.024a12.023 12.023 0 00-3.352-2.149l-2.022-1.012a2.25 2.25 0 00-2.24 0l-2.022 1.012A12.023 12.023 0 005.15 4.976m11.698-.016A11.959 11.959 0 0012 2.75a11.959 11.959 0 00-3.848.91M18.902 15.75c-.223.146-.46.284-.7.414m-14.404 0c.24.13.477.268.7.414M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const RecoveryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
const WrenchScrewdriverIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.472-2.472a3.375 3.375 0 00-4.773-4.773L6.75 21A2.652 2.652 0 009 21h1.42z" /></svg>;
const PluginIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v.448c0 .377-.24.72-.519.898l-6.25 3.333a1.5 1.5 0 00-.931 1.423v3.284a1.5 1.5 0 00.931 1.423l6.25 3.333c.279.178.519.521.519.898v.448c0 .355-.186.676-.401-.959a2.025 2.025 0 00-.349 1.003c0 1.035 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875a2.025 2.025 0 00-.349-1.003.94.94 0 00-.401-.959v-.448c0-.377.24-.72.519-.898l6.25-3.333a1.5 1.5 0 00.931-1.423v-3.284a1.5 1.5 0 00-.931-1.423l-6.25-3.333a1.026 1.026 0 00-.519-.898v-.448z" /></svg>;
const SocialIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.952a4.5 4.5 0 01-6.364-6.364v-.007A4.5 4.5 0 0110.5 9h.008a4.5 4.5 0 016.364 6.364v.007a4.5 4.5 0 01-6.364 6.364zM12 12a3 3 0 100-6 3 3 0 000 6z" /></svg>;
const ExtensionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-2.25 2.25m0 0l-2.25 2.25M18 9.75V15m0 6.75h.75a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 006 4.5v.75m12 15-2.25-2.25m0 0l-2.25-2.25m2.25 2.25V15m0 6.75h.75a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 006 4.5v.75m-3.75 3.75h.75a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-.75M3 15l2.25-2.25m0 0l2.25-2.25M5.25 12.75V7.5" /></svg>;
const ProxyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.375a6.375 6.375 0 006.375-6.375V9.75m-12 3.375c0-3.518 2.857-6.375 6.375-6.375V6.375m6.375 6.375v3.375c0 3.518-2.857 6.375-6.375-6.375m-6.375-6.375V9.75c0-3.518 2.857-6.375 6.375-6.375M3.375 9.75h17.25" /></svg>;
const ThemeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402a3.75 3.75 0 00-.615-6.228l-6.401 6.402a3.75 3.75 0 000 5.304z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-4.043-3.272-7.313-7.313-7.313a7.313 7.313 0 00-7.313 7.313c0 4.043 3.272 7.313 7.313 7.313a7.313 7.313 0 007.313-7.313z" /></svg>;
const CanvasIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const DatabaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5-3.75l-8.25 4.125-8.25-4.125" /></svg>;
const LayoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
const DiamondIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C13.18 7.76 14.735 9.75 16.5 12c1.096 1.35 2.296 2.046 3.5 2.25m-9.434 2.25c.348.12.703.235 1.062.341m-1.062-.341a3.374 3.374 0 01-3.374-3.374V7.5m3.374 4.125c-.348-.12-.703-.235-1.062-.341m1.062.341a3.374 3.374 0 003.374 3.374m0 0c1.12 0 2.233-.038 3.334-.114M12 9.75V12m0 0l3 3m-3-3l-3 3" /></svg>;
const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>;
const ScissorsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l-1.26.945a1.125 1.125 0 01-1.49-.046L3.12 6.375a1.125 1.125 0 01-.046-1.49l.945-1.26a1.125 1.125 0 011.872-.196l2.135 4.27a1.125 1.125 0 01-.196 1.872zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12.972 8.25l6.152-4.102a1.125 1.125 0 00-1.06-1.872l-4.102 6.152a1.125 1.125 0 00.196 1.872l4.27 2.135a1.125 1.125 0 001.49-.046l1.975-2.633a1.125 1.125 0 00-.046-1.49l-1.26-.945a1.125 1.125 0 00-1.872.196l-2.135-4.27a1.125 1.125 0 00-.196-1.872z" /></svg>;
const ExportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>;
const ClipboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 01-2.25 2.25h-1.5a2.25 2.25 0 01-2.25-2.25v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 01 1.927-.184" /></svg>;
const ArchiveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.75 7.5h16.5v-1.5A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v1.5z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>;
const GlobeEuropeAfricaIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664l.143.258a1.107 1.107 0 001.664.57l.143-.048a2.25 2.25 0 011.161.886l.51.766c.319.48.126 1.121-.216 1.49l-1.068.89a1.125 1.125 0 00-.405.864v.568m-6 0v-.568c0-.334-.148-.65-.405-.864l-1.068-.89a1.125 1.125 0 01-.216-1.49l.51-.766a2.25 2.25 0 001.161-.886l.143-.048a1.107 1.107 0 01.57-1.664l-.143-.258a1.107 1.107 0 01-1.664-.57l-.143.048a2.25 2.25 0 00-1.161-.886l-.51-.766a1.125 1.125 0 01.216-1.49l1.068-.89a1.125 1.125 0 00.405-.864v-.568m0 0a9 9 0 103.935 2.126M12 12a3 3 0 110-6 3 3 0 010 6z" /></svg>;

export const FeaturesView: React.FC = () => {
    return (
        <div>
            <header className="flex-shrink-0 p-6 border-b border-base-300 bg-base-200">
                <div className="text-center">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-base-content tracking-tight">The Architecture of Autonomy</h1>
                    <p className="mt-4 text-lg text-base-content/80 max-w-4xl mx-auto">
                       LlamaHub is not an application; it is a sovereign intelligence layer for your digital life. This is a showcase of the foundational pillars that make it the ultimate tool for privacy, power, and decentralized control.
                    </p>
                </div>
            </header>
            <main className="p-4 sm:p-6 md:p-8">
                <div className="container mx-auto px-4">
                    <Section title="The Unbreachable Sanctum">
                        <DetailCard title="Anonymity Through Tor" icon={<GlobeEuropeAfricaIcon />}>
                           Declare true digital sovereignty. For tasks requiring web access, LlamaHub can automatically route all backend network requests through a local Tor SOCKS proxy. This masks your digital footprint, protecting your research and queries from surveillance and ensuring your intellectual curiosity remains absolutely private.
                        </DetailCard>
                         <DetailCard title="The Living Knowledge Base" icon={<RagIcon />}>
                           Crucially, even when a cloud model is selected in hybrid mode, RAG operations like embedding and retrieval are performed entirely on your local machine. Your private knowledge never leaves your environment. Forge your own private intelligence with Retrieval-Augmented Generation (RAG) by `embed file` or `save to memory`, teaching LlamaHub from your own documents. It will prioritize this private knowledge, providing answers with unparalleled contextual accuracy.
                        </DetailCard>
                        <DetailCard title="The Digital Citadel" icon={<LockIcon />}>
                            Your privacy is not a feature; it is the foundation. All chats, settings, and knowledge are stored exclusively in your browser's local storage. Your data never leaves your machine unless you explicitly command it to.
                        </DetailCard>
                        <DetailCard title="Semantic Fragmentation Engine" icon={<ScissorsIcon />}>
                             Documents are not merely stored; they are understood. An intelligent text-chunking algorithm breaks down knowledge into contextually relevant, overlapping fragments, ensuring the AI retrieves the most precise information for any query.
                        </DetailCard>
                        <DetailCard title="Absolute Data Sovereignty" icon={<ExportIcon />}>
                            You own your data, completely. Export your entire knowledge base as a single JSON file, or download individual documents as text. Your data is never locked into our platform.
                        </DetailCard>
                         <DetailCard title="Intelligent Ingestion Protocol" icon={<ClipboardIcon />}>
                            Pasting large blocks of text automatically converts them into an attached file. This keeps your chat clean and streamlines the process of analyzing large data dumps without cluttering the conversation.
                        </DetailCard>
                         <DetailCard title="The Conversation Archive" icon={<ArchiveIcon />}>
                            Master your conversational history. Archive completed chats to keep your workspace focused, while retaining the ability to search and retrieve them at any time.
                        </DetailCard>
                         <DetailCard title="The 'Scorched Earth' Protocol" icon={<DeleteIcon />}>
                            Exercise your right to be forgotten. A single action in the settings allows you to permanently delete all chats and knowledge from your browser, resetting the system to a pristine, factory-fresh state.
                        </DetailCard>
                    </Section>

                    <Section title="The Sovereign Intelligence Core">
                        <DetailCard title="The Sovereign & Cloud Duality" icon={<DualAiIcon />}>
                            Declare your digital independence. Seamlessly switch between a 100% offline, private local LLM or a powerful cloud provider. This is not just a feature; it is a fundamental choice over your data's sovereignty, configurable at any time.
                        </DetailCard>
                         <DetailCard title="Sentient Conversational Core" icon={<ConversationIcon />}>
                            Engage in coherent, long-form dialogue. LlamaHub maintains deep context, automatically titling conversations for effortless organization and ensuring every interaction is relevant and intelligent.
                        </DetailCard>
                        <DetailCard title="Universal Sensory Input" icon={<MultimodalIcon />}>
                            Go beyond text. Analyze images with vision models, generate photorealistic art with the `generate image` command, and extract text from any picture with OCR. LlamaHub perceives your digital world as you do.
                        </DetailCard>
                        <DetailCard title="Command & Synthesis Protocol" icon={<VoiceIcon />}>
                            Experience true hands-free operation. Utilize browser-native Speech-to-Text for input and Text-to-Speech for output. The system is architected for future integration with custom, high-fidelity voice engines.
                        </DetailCard>
                         <DetailCard title="Dynamic Reality Engine" icon={<MagicIcon />}>
                            The system prompt is not static; it's a living document. It is dynamically enriched with the current date, time, and context from your knowledge base, grounding the AI in your immediate reality for superior relevance.
                        </DetailCard>
                    </Section>
                    
                    <Section title="The Autonomous Agent Collective">
                        <DetailCard title="Multi-Agent Strategic Research" icon={<ResearchIcon />}>
                            Deploy a local-first team of AI agents for deep research. This powerful system autonomously plans, retrieves, and synthesizes information, governed by a resource manager to ensure system stability. All findings are saved locally, with optional, user-approved online fact-checking.
                        </DetailCard>
                        <DetailCard title="Universal Information Access" icon={<WebIcon />}>
                            Break free from outdated training data. `search` the live web, `curl` or `analyze website` to master the content of any URL, and `download` files directly. The internet is not just a source; it's an extension of LlamaHub's mind.
                        </DetailCard>
                        <DetailCard title="The Digital Foundry" icon={<CodeIcon />}>
                             Command a secure, sandboxed Code Interpreter with the `/python` command. Generate, debug, and refactor complex scripts on the fly. LlamaHub is not just a coder; it is an entire AI-driven development environment.
                        </DetailCard>
                         <DetailCard title="Hardened System Interface" icon={<ShieldCheckIcon />}>
                            Execute a whitelist of safe, read-only shell commands directly from the chat. The backend proxy server provides a secure, air-gapped interface to your system, ensuring every command is validated and controlled.
                        </DetailCard>
                        <DetailCard title="Failsafe Recovery Protocol" icon={<RecoveryIcon />}>
                            A "break glass" security feature. A secret passphrase activates a separate, admin-approved command whitelist, enabling controlled execution of system-critical recovery scripts with full logging for ultimate peace of mind.
                        </DetailCard>
                        <DetailCard title="The Expert Co-Pilot" icon={<WrenchScrewdriverIcon />}>
                            For sensitive file system or process management tasks (`create file`, `kill process`), LlamaHub generates the precise, safe command for you to copy and execute, acting as an infallible command-line expert.
                        </DetailCard>
                    </Section>
                    
                    <Section title="The Ubiquitous Network">
                        <DetailCard title="Enterprise & Productivity Suite" icon={<PluginIcon />}>
                            Achieve total command over your digital life. Through secure, user-controlled OAuth 2.0, integrate with Google Workspace to manage your Drive, search your Gmail, and check your Calendar directly from the AI interface.
                        </DetailCard>
                        <DetailCard title="Digital Kingdom Command" icon={<SocialIcon />}>
                            Integrate with platforms like Discord, Telegram, and Shopify via secure tokens and API keys. Automate posts, send messages, and manage your digital storefront with natural language commands.
                        </DetailCard>
                        <DetailCard title="The Omnipresent Connector" icon={<ExtensionIcon />}>
                            Bridge your browsing with your AI. The companion browser extension allows you to send the full context of any webpage to LlamaHub to be summarized, analyzed, or used as a basis for custom prompts.
                        </DetailCard>
                        <DetailCard title="The Secure Relay" icon={<ProxyIcon />}>
                             The lightweight Node.js backend proxy enables secure, server-to-server API calls, bypassing browser security limitations to allow for robust integrations and system-level commands that would otherwise be impossible.
                        </DetailCard>
                    </Section>
                    
                     <Section title="The Symbiotic Interface">
                        <DetailCard title="Total Environment Control" icon={<ThemeIcon />}>
                           Mold your workspace. With over 30 themes, adjustable font sizes, and a resizable sidebar, you can craft an environment that is a perfect extension of your personal workflow and aesthetic.
                        </DetailCard>
                        <DetailCard title="The Sentient Workspace" icon={<CanvasIcon />}>
                            A collaborative interface for you and the AI. Load PDFs, DOCX files, code, and images. The AI becomes context-aware of the active file, allowing you to chat, edit, and create together in a shared space.
                        </DetailCard>
                        <DetailCard title="The Memory Palace" icon={<DatabaseIcon />}>
                           A dedicated UI to manage LlamaHub's long-term memory. View, search, export, or delete any document from the knowledge base, giving you complete, transparent control over what your AI knows.
                        </DetailCard>
                         <DetailCard title="Fluid Operational Canvas" icon={<LayoutIcon />}>
                           The UI is engineered for a seamless experience on any device. The fully responsive layout and collapsible sidebar ensure that you have maximum focus and control, whether on a 4K monitor or a tablet.
                        </DetailCard>
                         <DetailCard title="The Command Arsenal" icon={<WrenchScrewdriverIcon />}>
                            Discover the full extent of LlamaHub's power with ease. All tools are logically organized in the sidebar and a quick-access popover menu, transforming complex capabilities into accessible, one-click actions.
                        </DetailCard>
                         <DetailCard title="The Professional Cockpit" icon={<DiamondIcon />}>
                             This entire website is a pixel-perfect replica of the application, reflecting a deep commitment to a polished, intuitive, and professional-grade user experience designed for the most demanding users.
                         </DetailCard>
                    </Section>

                </div>
            </main>
        </div>
    );
};
