
import React from 'react';
import { useStore } from '../store';

export const DeepResearchStatus: React.FC = () => {
    const researchJob = useStore(state => state.researchJob);
    const setResearchJob = useStore(state => state.setResearchJob);

    if (!researchJob || researchJob.status === 'complete' || researchJob.status === 'error') {
        return null;
    }

    const handleConfirmFactCheck = (confirm: boolean) => {
        if (!researchJob) return;
        if (confirm) {
            setResearchJob({
                ...researchJob,
                status: 'running',
                currentAgent: 'FactChecker',
                statusMessage: 'Fact-checking with cloud provider...',
                completedSteps: [...researchJob.completedSteps, 'factcheck-confirmed'],
            });
        } else {
            setResearchJob({
                ...researchJob,
                status: 'complete',
                currentAgent: null,
                statusMessage: 'Research complete. Fact-checking skipped by user.',
            });
        }
    };

    return (
        <div className="w-full bg-base-200 border border-base-300 rounded-lg p-2 mb-2 text-sm text-base-content">
            {researchJob.status === 'confirm_factcheck' ? (
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-semibold">Confirm Fact-Checking</p>
                        <p className="text-xs text-base-content/70">Use a cloud model for up-to-date fact-checking? This may use an API key.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleConfirmFactCheck(true)} className="btn btn-xs btn-success">Yes, Proceed</button>
                        <button onClick={() => handleConfirmFactCheck(false)} className="btn btn-xs btn-ghost">No, Skip</button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <span className="loading loading-spinner loading-sm text-primary"></span>
                    <div>
                        <p className="font-semibold">Local Deep Research in Progress</p>
                        <p className="text-xs text-base-content/70">
                            <span className="font-bold">{researchJob.currentAgent}:</span> {researchJob.statusMessage}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
