
import React, { useState } from 'react';
import { useStore } from '../store';

interface EmergencyRecoveryModalProps {
  // No props needed after refactoring
}

export const EmergencyRecoveryModal: React.FC<EmergencyRecoveryModalProps> = () => {
  const isOpen = useStore(state => state.isRecoveryModalOpen);
  const close = useStore(state => state.closeRecoveryModal);
  const confirm = useStore(state => state.confirmRecovery);
  const recoveryPassphrase = useStore(state => state.settings.recoveryPassphrase);
  
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (input === recoveryPassphrase) {
      confirm();
    } else {
      alert('Incorrect passphrase.');
    }
  };

  const isConfirmed = recoveryPassphrase && input === recoveryPassphrase;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={close}>
      <div 
        className="bg-red-900/50 border-2 border-red-500 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col text-red-100 backdrop-blur-sm"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-6 border-b-2 border-red-500/50 flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-red-300 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <h2 className="text-2xl font-bold text-white">Emergency Recovery Mode</h2>
            <p className="text-red-200">System modification commands are being enabled.</p>
          </div>
        </header>

        <main className="p-6 space-y-4">
            <p className="font-semibold text-lg">WARNING: This is a "break glass" feature for system recovery.</p>
            <p className="text-red-200">You are about to activate a mode that allows LlamaHub to execute pre-approved system scripts. These scripts can modify your local configuration. Proceed only if you understand the risks and have no other recovery options.</p>
            <p className="text-red-200">This mode will automatically deactivate after **one** command is executed.</p>

            <div className="mt-6">
                 <label htmlFor="passphrase-confirm" className="font-bold text-white block mb-2">
                    To proceed, please type the recovery passphrase again:
                </label>
                <input
                    id="passphrase-confirm"
                    type="password"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && isConfirmed) handleConfirm() } }
                    className="w-full p-3 rounded-md bg-red-950/70 border-2 border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 text-white font-mono"
                    autoFocus
                    placeholder={!recoveryPassphrase ? 'No passphrase set in settings' : ''}
                    disabled={!recoveryPassphrase}
                />
            </div>
        </main>
        
        <footer className="p-4 bg-black/30 border-t-2 border-red-500/50 flex justify-end items-center gap-4">
            <button onClick={close} className="px-6 py-2 text-sm bg-gray-600/50 hover:bg-gray-500/50 rounded-md text-white">
              Cancel
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={!isConfirmed}
                className="px-6 py-2 text-sm bg-red-600 hover:bg-red-500 rounded-md text-white font-bold disabled:bg-red-800/50 disabled:cursor-not-allowed disabled:text-red-300/50"
            >
              Activate Recovery Mode
            </button>
        </footer>
      </div>
    </div>
  );
};
