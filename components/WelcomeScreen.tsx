
import React from 'react';
import { EXAMPLE_PROMPTS } from '../constants';
import { useStore } from '../store';

const ScriptIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V5.75A2.25 2.25 0 0 0 18 3.5H6A2.25 2.25 0 0 0 3.75 5.75v12.25A2.25 2.25 0 0 0 6 20.25Z" />
    </svg>
);

const ImageAnalysisIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);

const SystemStatusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h4.5M15 3v4.5m0-4.5h4.5m-4.5 0L15 7.5M3 7.5h7.5" />
    </svg>
);

const ToolIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
);


interface WelcomeScreenProps {
  // No props needed after refactoring
}

const ChoiceCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; }> = ({ title, description, icon, onClick }) => (
    <button onClick={onClick} className="text-left p-4 rounded-lg bg-base-200 hover:bg-base-300 transition-all duration-200 w-full h-full flex flex-col">
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-base-content/70">{icon}</div>
            <div className="flex-1">
                <h3 className="font-semibold text-base-content mb-1">{title}</h3>
                <p className="text-sm text-base-content/70">{description}</p>
            </div>
        </div>
    </button>
);


export const WelcomeScreen: React.FC<WelcomeScreenProps> = () => {
    const sendMessage = useStore(state => state.sendMessage);
    const greeting = useStore(state => state.settings.startupGreeting);
    
    const promptIcons: { [key: string]: React.ReactNode } = {
        'Create a custom tool': <ToolIcon />,
        'Analyze an image': <ImageAnalysisIcon />,
        'Generate a script': <ScriptIcon />,
        'Check system status': <SystemStatusIcon />,
    };

    return (
        <div className="flex flex-col h-full bg-base-100">
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex items-center justify-center">
                <div className="max-w-4xl w-full text-center">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-base-content mb-4">
                        {greeting}
                    </h1>
                    <p className="text-base-content/70 mb-10 max-w-2xl mx-auto">
                        What can I help you with today? You can start a new chat or pick a suggestion. For setup instructions, please see the `README.md` file.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                        {EXAMPLE_PROMPTS.slice(0, 4).map((prompt) => (
                             <ChoiceCard
                                key={prompt.title}
                                icon={promptIcons[prompt.title] || <ScriptIcon />}
                                title={prompt.title}
                                description={prompt.prompt}
                                onClick={() => sendMessage(prompt.prompt)}
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};
