
import React, { useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { SettingsModal } from './components/SettingsModal';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { EmergencyRecoveryModal } from './components/EmergencyRecoveryModal';
import { SmartCanvas } from './components/SmartCanvas';
import { useStore, type ActiveView, type AppCoreViews } from './store';
import { type ChatInputHandle } from './components/ChatInput';

import * as knowledgeStore from './services/knowledgeStore';
import * as speechService from './services/speechService';
import * as googleAuthService from './services/googleAuthService';
import * as pyodideService from './services/pyodideService';
import * as settingsStore from './services/settings';
import * as researchService from './services/researchService';

// Informational Views
import { InformationalLayout } from './components/InformationalLayout';
import { HomeView } from './components/HomeView';
import { FeaturesView } from './components/FeaturesView';
import { AboutView } from './components/AboutView';
import { MissionView } from './components/MissionView';
import { ProposalsView } from './components/ProposalsView';
import { InvestorsView } from './components/InvestorsView';
import { ContactView } from './components/ContactView';
import { LocalLLMView } from './components/LocalLLMView';
import { DecentralizationView } from './components/DecentralizationView';
import { Footer } from './components/Footer';


const App: React.FC = () => {
  const chatInputRef = useRef<ChatInputHandle>(null);

  const sidebarOpen = useStore(state => state.sidebarOpen);
  const isSettingsOpen = useStore(state => state.isSettingsOpen);
  const activeView = useStore(state => state.activeView);
  const isRecoveryModalOpen = useStore(state => state.isRecoveryModalOpen);
  const isCanvasOpen = useStore(state => state.isCanvasOpen);
  const currentChatId = useStore(state => state.currentChatId);
  
  const storedSettings = useStore(state => state.settings);
  const mcpJobs = useStore(state => state.mcpJobs) || {};
  const researchJob = useStore(state => state.researchJob);
  const researchWorkerRef = useRef<Worker | null>(null);

  const settings = storedSettings || settingsStore.DEFAULT_SETTINGS;

  const fullSettings = useMemo(() => ({
    ...settings,
    enablePython: true,
  }), [settings]);
  
  const theme = settings.theme;
  const fontSize = settings.fontSize;

  const { 
    setSidebarOpen,
    setActiveView,
    initialize, 
    setGoogleAuthState 
  } = useStore.getState();

  useEffect(() => {
    knowledgeStore.configure({
      aiProvider: fullSettings.aiProvider === 'dev' ? 'cloud' : fullSettings.aiProvider,
      embeddingProvider: fullSettings.embeddingProvider,
      embeddingUrl: fullSettings.localLlmEmbeddingUrl || fullSettings.localLlmUrl,
      localLlmEmbeddingModel: fullSettings.localLlmEmbeddingModel,
      geminiEmbeddingModel: fullSettings.geminiEmbeddingModel,
      customHeaders: fullSettings.customHeaders,
      chunkSize: fullSettings.chunkSize,
      chunkOverlap: fullSettings.chunkOverlap,
      developerMode: fullSettings.developerMode,
      dev_geminiApiKey: fullSettings.dev_geminiApiKey,
      dev_openAiApiKey: fullSettings.dev_openAiApiKey,
      cloudProvider: fullSettings.cloudProvider,
      cloudApiUrl: fullSettings.cloudApiUrl,
      model: fullSettings.model,
    });
    speechService.configure({
      enabled: fullSettings.voiceEnabled,
      readAloud: fullSettings.readAloud,
      ttsProvider: fullSettings.ttsProvider,
      ttsVoiceName: fullSettings.ttsVoiceName,
      piperTtsUrl: fullSettings.piperTtsUrl,
      sttProvider: fullSettings.sttProvider,
      voskSttUrl: fullSettings.voskSttUrl,
      enableSileroVad: fullSettings.enableSileroVad,
      enablePorcupineWakeWord: fullSettings.enablePorcupineWakeWord,
      porcupineAccessKey: fullSettings.porcupineAccessKey,
      proxyUrl: fullSettings.proxyUrl,
    });

    const googleKeys = {
      clientId: (fullSettings.developerMode && fullSettings.dev_googleClientId) 
          ? fullSettings.dev_googleClientId 
          : (import.meta.env.VITE_GOOGLE_CLIENT_ID || ''),
      developerApiKey: (fullSettings.developerMode && fullSettings.dev_googleDeveloperApiKey) 
          ? fullSettings.dev_googleDeveloperApiKey 
          : (import.meta.env.VITE_GOOGLE_DEVELOPER_API_KEY || ''),
    };
    googleAuthService.initClient({ onStateChange: setGoogleAuthState }, googleKeys);

    if (fullSettings.enablePython) {
        pyodideService.initPyodide(fullSettings.pyodideUrl);
    }
  }, [fullSettings, setGoogleAuthState]);

  useEffect(() => {
    (async () => {
      await knowledgeStore.initKnowledgeStore();
      if (useStore.persist.hasHydrated()) {
        initialize();
      } else {
        useStore.persist.onFinishHydration(initialize);
      }
    })().catch(err => {
      console.error("Failed to initialize knowledge store:", err);
      if (useStore.persist.hasHydrated()) {
        initialize();
      } else {
        useStore.persist.onFinishHydration(initialize);
      }
    });
  }, [initialize]);
  
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.fontSize = `${fontSize}px`;
  }, [theme, fontSize]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const activeJobCount = Object.keys(mcpJobs).length;

    if (activeJobCount > 0) {
      intervalId = setInterval(() => {
        useStore.getState().pollMcpJobs();
      }, 5000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [mcpJobs]);
  
  // Initialize and manage the Deep Research Worker
  useEffect(() => {
    // This worker handles the complex, multi-step deep research process in the background.
    const workerUrl = new URL('./workers/research.worker.js', window.location.origin);
    researchWorkerRef.current = new Worker(workerUrl, { type: 'module' });

    // Listen for progress updates or the final result from the worker
    researchWorkerRef.current.onmessage = (event: MessageEvent) => {
        const { type, job } = event.data;
        if (job) {
            useStore.getState().setResearchJob(job);
        }
    };

    researchWorkerRef.current.onerror = (error) => {
        console.error("Deep Research Worker Error:", error);
        const currentJob = useStore.getState().researchJob;
        if (currentJob) {
             useStore.getState().setResearchJob({
                ...currentJob,
                status: 'error',
                statusMessage: `A critical error occurred in the research worker: ${error.message}`
            });
        }
    };

    // Terminate the worker on component unmount to prevent memory leaks
    return () => {
        researchWorkerRef.current?.terminate();
        researchWorkerRef.current = null;
    };
  }, []); // Run only once on mount

  // This effect is responsible for starting a new research job in the worker.
  useEffect(() => {
      // This condition is crucial: it ensures we only send the *initial* "start" signal.
      // The worker will manage all subsequent steps internally. We detect the start
      // of a job by its 'running' status and an empty `completedSteps` array.
      if (researchJob && researchJob.status === 'running' && researchJob.completedSteps.length === 0) {
          const apiKey = (fullSettings.developerMode && fullSettings.dev_geminiApiKey)
              ? fullSettings.dev_geminiApiKey
              : (process.env.API_KEY || '');

          researchWorkerRef.current?.postMessage({
              job: researchJob,
              settings: fullSettings,
              apiKey: apiKey, // Pass the API key securely to the worker
          });
      }
  }, [researchJob, fullSettings]);


  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
        if (event.source !== window) return;
        const { source, command, payload } = event.data;
        if (source !== 'francine-extension' || !command || !payload) return;
        
        window.focus();

        const state = useStore.getState();
        if (!state.currentChatId) {
            state.newChat();
        }

        let promptText = '';
        switch (command) {
            case 'summarizePage':
                promptText = `Please summarize the following content from the URL ${payload.url}:\n\n---\n\n${payload.text}`;
                break;
            case 'analyzeSelection':
                promptText = `Please analyze the following selected text from the URL ${payload.url}:\n\n---\n\n${payload.selection}`;
                break;
            case 'customPrompt':
                 promptText = `CONTEXT from URL ${payload.url}:\n\n${payload.text}\n\n---\n\nUSER PROMPT: ${payload.prompt}`;
                break;
        }

        if (promptText) {
            // Wait for new chat state to propagate if needed.
            setTimeout(() => {
                useStore.getState().sendMessage(promptText);
            }, 100);
        }
    };
    
    window.addEventListener('message', handleExtensionMessage);

    return () => {
        window.removeEventListener('message', handleExtensionMessage);
    };
  }, [currentChatId]);

  const appCoreViews: AppCoreViews[] = ['chat', 'knowledge'];
  const isAppView = appCoreViews.includes(activeView as AppCoreViews);

  const renderInformationalContent = () => {
    switch(activeView) {
        case 'home': return <HomeView />;
        case 'features': return <FeaturesView />;
        case 'about': return <AboutView />;
        case 'mission': return <MissionView />;
        case 'proposals': return <ProposalsView />;
        case 'investors': return <InvestorsView />;
        case 'contact': return <ContactView />;
        case 'localLlm': return <LocalLLMView />;
        case 'decentralization': return <DecentralizationView />;
        default: return <HomeView />;
    }
  }

  if (isAppView) {
    return (
        <div className="flex h-screen w-screen overflow-hidden font-sans bg-base-100 text-base-content">
            <Sidebar
                onSelectCommand={(tool) => {
                    if (tool.command.trim() === 'canvas open') {
                        useStore.getState().openCanvas();
                    } else if (tool.command.trim().endsWith(' ')) {
                        chatInputRef.current?.insertText(tool.command);
                    } else {
                        chatInputRef.current?.stageCommand(tool);
                    }
                }}
            />
            <div className="flex-1 flex flex-row relative min-w-0">
                {isCanvasOpen && <SmartCanvas settings={fullSettings} />}
                <div className="flex-1 flex flex-col min-w-0">
                    {activeView === 'chat' ? <ChatView ref={chatInputRef} /> : <KnowledgeBaseView />}
                </div>
            </div>
            {isSettingsOpen && <SettingsModal />}
            {isRecoveryModalOpen && <EmergencyRecoveryModal />}
        </div>
    );
  }
  
  // FIX: Added a return statement with a valid JSX structure to fix the component's return type.
  return (
    <InformationalLayout>
        {renderInformationalContent()}
        <Footer />
    </InformationalLayout>
  );
};

// FIX: Added a default export to match the import statement in index.tsx.
export default App;
