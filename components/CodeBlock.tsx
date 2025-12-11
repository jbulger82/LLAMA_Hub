
import React, { useState } from 'react';
import * as pyodideService from '../services/pyodideService';
import { useStore } from '../store';

interface CodeBlockProps {
  language: string;
  code: string;
}

// Icons
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 0 1-2.25 2.25h-1.5a2.25 2.25 0 0 1-2.25-2.25v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
);

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
);


export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const { settings } = useStore.getState();

    const handleRunCode = async () => {
        setIsRunning(true);
        setOutput('Executing code...');
        const result = await pyodideService.runPython(code);
        setOutput(result);
        setIsRunning(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const isRunnable = language === 'python' && settings.enablePython;

    return (
        <div className="bg-black text-gray-300 rounded-lg my-2 border border-gray-700 font-mono text-sm shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-2 bg-gray-900/70 border-b border-gray-700 rounded-t-lg">
                <span className="font-semibold capitalize text-gray-400">{language}</span>
                <button 
                    onClick={handleCopy} 
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-700 transition-colors"
                >
                    {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                    {isCopied ? 'Copied!' : 'Copy code'}
                </button>
            </div>
            
            {/* Code Area */}
            <div className="p-4 overflow-x-auto bg-gray-900/30">
                <pre><code>{code}</code></pre>
            </div>
            
            {/* Output Area (conditionally rendered) */}
            {output && (
                <div className="border-t border-gray-700">
                    <div className="px-4 py-2 bg-gray-900/70">
                        <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Output</h4>
                    </div>
                    <div className="p-4 overflow-x-auto max-h-60">
                        <pre className="text-xs whitespace-pre-wrap">{output}</pre>
                    </div>
                </div>
            )}
            
            {/* Footer with Run Button (conditionally rendered) */}
            {isRunnable && (
                <div className="flex justify-end items-center px-4 py-2 bg-gray-900/70 border-t border-gray-700 rounded-b-lg">
                    <button 
                        onClick={handleRunCode} 
                        disabled={isRunning} 
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isRunning ? (
                            <>
                                <span className="loading loading-spinner loading-xs"></span>
                                Running...
                            </>
                        ) : (
                            <>
                                <PlayIcon className="w-4 h-4" />
                                Run Code
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
