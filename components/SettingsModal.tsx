import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as settingsStore from '../services/settings';
import * as knowledgeStore from '../services/knowledgeStore';
import * as googleAuthService from '../services/googleAuthService';
import * as speechService from '../services/speechService';
import * as systemService from '../services/systemService';
import * as voiceIntegrationService from '../services/voiceIntegrationService';
import { SOCIAL_PLATFORMS } from '../constants';
import { type PlatformConfig, type PlatformCredentials, type SocialPlatformId, type AgentRole, AGENT_ROLES, type AgentConfig } from '../types';
import { buildPromptPreview, CUSTOM_PROMPT_TEMPLATE_HELP } from '../services/promptBuilder';
import { useStore } from '../store';


interface SettingsModalProps {
  // No props needed after refactoring
}

type Category = 'general' | 'memory' | 'model' | 'multiAgent' | 'mcp' | 'imageGeneration' | 'networking' | 'voice' | 'integrations' | 'social' | 'debug' | 'about';

const SectionTitle: React.FC<{children: React.ReactNode}> = ({children}) => (
    <h3 className="text-lg font-semibold text-base-content mt-6 mb-4 border-b border-base-300 pb-2">{children}</h3>
);

const ToggleSwitch: React.FC<{ label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; tooltip?: string; disabled?: boolean; }> = 
  ({ label, description, checked, onChange, tooltip, disabled = false }) => (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="flex items-center gap-2">
        <div>
            <label className={`font-medium text-base-content ${disabled ? 'cursor-not-allowed' : ''}`}>{label}</label>
            <p className="text-xs text-base-content/70">{description}</p>
        </div>
        {tooltip && (
            <div className="tooltip" data-tip={tooltip}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-base-content/50 cursor-help">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </div>
        )}
      </div>
      <input type="checkbox" className="toggle toggle-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
    </div>
);

const Slider: React.FC<{ label: string; description?: string; min: number; max: number; step: number; value: number; name: string; onChange: (e: React.ChangeEvent<any>) => void; disabled?: boolean; }> = 
  ({ label, description, min, max, step, value, name, onChange, disabled = false }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <label className="font-medium text-base-content">{label}</label>
      <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded">{value}</span>
    </div>
    {description && <p className="text-xs text-base-content/70">{description}</p>}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      name={name}
      onChange={onChange}
      disabled={disabled}
      className="range range-primary"
    />
  </div>
);

const InputField: React.FC<{ label: string; description?: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; placeholder?: string, disabled?: boolean, step?: string }> =
    ({ label, description, name, value, onChange, type = 'text', placeholder, disabled = false, step }) => (
    <div>
        {label && <label htmlFor={name} className="font-medium text-base-content block mb-1">{label}</label>}
        {description && <p className="text-xs text-base-content/70 mb-2">{description}</p>}
        <input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            step={step}
            className="w-full p-2 rounded-md bg-base-200 border border-base-300 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
    </div>
);

const SelectField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; description?: string; disabled?: boolean; }> =
  ({ label, name, value, onChange, children, description, disabled = false }) => (
  <div>
    {label && <label htmlFor={name} className="font-medium text-base-content block mb-1">{label}</label>}
    {description && <p className="text-xs text-base-content/70 mb-2">{description}</p>}
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full p-2 rounded-md bg-base-200 border border-base-300 select select-bordered"
    >
      {children}
    </select>
  </div>
);

const KeyStatus: React.FC<{ label: string; isSet: boolean; envVar: string }> = ({ label, isSet, envVar }) => (
    <div>
        <label className="font-medium text-base-content block mb-1">{label}</label>
        <div className="flex items-center gap-3 bg-base-200 p-3 rounded-md border border-base-300">
            <span className={`badge ${isSet ? 'badge-success' : 'badge-warning'}`}>{isSet ? 'Configured' : 'Not Set'}</span>
            <div className="text-xs text-base-content/70">
                {isSet 
                    ? `Reading from your environment.` 
                    : <span>Set <code className="bg-base-300 px-1 rounded">{envVar}</code> in your <code className="bg-base-300 px-1 rounded">.env</code> file. See README.</span>
                }
            </div>
        </div>
    </div>
);


const PlatformIntegrationRow: React.FC<{
    platform: PlatformConfig,
    creds: PlatformCredentials,
    onChange: (platformId: SocialPlatformId, field: keyof PlatformCredentials, value: string) => void,
    onConnectToggle: (platformId: SocialPlatformId, shouldConnect: boolean) => void,
}> = ({ platform, creds, onChange, onConnectToggle }) => {
    
    const handleConnect = () => {
        const hasCreds = creds.apiKey || creds.botToken || creds.appPassword || creds.clientId;
        if(hasCreds) {
            onConnectToggle(platform.id, true);
        } else {
            alert(`Please fill in the required credentials for ${platform.name} to connect.`);
        }
    };

    const handleDisconnect = () => onConnectToggle(platform.id, false);

    const renderAuthInputs = () => {
        switch(platform.authType) {
            case 'apikey':
                return <InputField type="password" label="API Key" name="apiKey" value={creds.apiKey || ''} onChange={e => onChange(platform.id, 'apiKey', e.target.value)} />;
            case 'bot_token':
                return <InputField type="password" label="Bot Token" name="botToken" value={creds.botToken || ''} onChange={e => onChange(platform.id, 'botToken', e.target.value)} />;
            case 'app_password':
                 return <InputField type="password" label="App Password / Token" name="appPassword" value={creds.appPassword || ''} onChange={e => onChange(platform.id, 'appPassword', e.target.value)} />;
            default:
                return null;
        }
    }

    return (
        <div className="p-4 bg-base-200 rounded-lg border border-base-300">
            <div className="flex justify-between items-start gap-4">
                <div>
                    <div className="flex items-center gap-3">
                         <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${platform.blocked ? 'bg-warning' : (creds.connected ? 'bg-success' : 'bg-base-content/30')}`}></span>
                        <div>
                            <h4 className="font-semibold text-base-content text-base">{platform.name}</h4>
                             <a href={platform.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                API Documentation
                            </a>
                        </div>
                    </div>
                </div>
                <div>
                    {platform.blocked ? (
                         <span className="px-3 py-1.5 text-sm font-medium bg-warning/20 text-warning rounded-md">Blocked</span>
                    ) : creds.connected ? (
                        <button onClick={handleDisconnect} className="btn btn-error btn-outline btn-sm">Disconnect</button>
                    ) : (
                        <button onClick={handleConnect} className="btn btn-primary btn-sm">Connect</button>
                    )}
                </div>
            </div>
             {platform.blocked ? (
                <div className="mt-4 pt-3 border-t border-base-300 flex gap-3 items-start text-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" /></svg>
                    <p className="text-xs "><strong className="font-semibold">Reason Blocked:</strong> {platform.blockedReason}</p>
                </div>
            ) : !creds.connected && (
                <div className="mt-4 pt-4 border-t border-base-300">
                    {renderAuthInputs()}
                </div>
            )}
        </div>
    );
};

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => (
    <div className="collapse collapse-plus border border-base-300 bg-base-100">
        <input type="checkbox" defaultChecked={defaultOpen} />
        <div className="collapse-title text-md font-semibold text-base-content">
            {title}
        </div>
        <div className="collapse-content !p-0">
            <div className="p-4 bg-base-100/50 space-y-4">
                 {children}
            </div>
        </div>
    </div>
);

interface TorStatus {
    ip: string | null;
    isTor: boolean | null;
    proxy: string | null;
    toggleError: string | null;
    verifyError: string | null;
    loading: boolean;
    checkingToggle?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = () => {
  // Select only primitives and functions to avoid re-renders from object reference changes.
  const isSettingsOpen = useStore(state => state.isSettingsOpen);
  const closeSettingsModal = useStore(state => state.closeSettingsModal);
  const updateGlobalSettings = useStore(state => state.saveSettings);
  const clearAllChats = useStore(state => state.clearAllChats);
  const isGoogleSignedIn = useStore(state => state.isGoogleSignedIn);
  const googleUser = useStore(state => state.googleUser);
  const mcpStatuses = useStore(state => state.mcpStatuses);
  const mcpTools = useStore(state => state.mcpTools);
  const fetchMcpMeta = useStore(state => state.fetchMcpMeta);
  const isFetchingMcp = useStore(state => state.isFetchingMcp);

  // Initialize local state for settings. This is only set once on initial render.
  const [tempSettings, setTempSettings] = useState(() => useStore.getState().settings);
  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [promptPreview, setPromptPreview] = useState('');
  const [torStatus, setTorStatus] = useState<TorStatus>({ ip: null, isTor: null, proxy: null, toggleError: null, verifyError: null, loading: false, checkingToggle: false });
  // State for Dev Provider model fetching
  const [devModels, setDevModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);
  // State for agent model fetching
  // FIX: Initialize agent-related states with a properly typed Record
  // to satisfy TypeScript's requirement for all AgentRole keys to be present.
  const [agentModels, setAgentModels] = useState<Record<AgentRole, string[]>>(
    () => Object.fromEntries(AGENT_ROLES.map(r => [r, []])) as Record<AgentRole, string[]>
  );
  const [isFetchingAgentModels, setIsFetchingAgentModels] = useState<Record<AgentRole, boolean>>(
    () => Object.fromEntries(AGENT_ROLES.map(r => [r, false])) as Record<AgentRole, boolean>
  );
  const [fetchAgentModelsError, setFetchAgentModelsError] = useState<Record<AgentRole, string | null>>(
    () => Object.fromEntries(AGENT_ROLES.map(r => [r, null])) as Record<AgentRole, string | null>
  );
  const [piperCommandStatus, setPiperCommandStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [whisperCommandStatus, setWhisperCommandStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [piperCommandLoading, setPiperCommandLoading] = useState(false);
  const [whisperCommandLoading, setWhisperCommandLoading] = useState(false);


  const cloudApiKeyIsSet = useMemo(() => {
    if (tempSettings.developerMode) {
      return tempSettings.cloudProvider === 'gemini'
        ? !!tempSettings.dev_geminiApiKey
        : !!tempSettings.dev_openAiApiKey;
    }
    return !!process.env.API_KEY;
  }, [tempSettings.developerMode, tempSettings.cloudProvider, tempSettings.dev_geminiApiKey, tempSettings.dev_openAiApiKey]);
  
  const googleClientIdIsSet = useMemo(() => !!(process.env.GOOGLE_CLIENT_ID || tempSettings.dev_googleClientId), [tempSettings.dev_googleClientId]);
  const googleDevApiKeyIsSet = useMemo(() => !!(process.env.GOOGLE_API_DEVELOPER_KEY || tempSettings.dev_googleDeveloperApiKey), [tempSettings.dev_googleDeveloperApiKey]);

  const fetchTorStatus = useCallback(async () => {
    try {
        const response = await fetch(`${tempSettings.proxyUrl}/proxy/settings/tor`);
        if (!response.ok) throw new Error('Failed to fetch Tor status from proxy.');
        const data = await response.json();
        setTempSettings(prev => ({ ...prev, torModeEnabled: data.enabled }));
        setTorStatus(prev => ({ ...prev, proxy: data.proxy, toggleError: null }));
    } catch (error: any) {
        setTorStatus(prev => ({ ...prev, toggleError: error.message, proxy: null }));
    }
  }, [tempSettings.proxyUrl]);

  useEffect(() => {
    if (isSettingsOpen) {
      setTempSettings(useStore.getState().settings);

      // The speech service populates voices on load and on change.
      // We just need to get the latest list when the modal opens.
      const voices = speechService.getVoices();
      setAvailableVoices(voices);
      
      const timer = setTimeout(() => {
          setAvailableVoices(speechService.getVoices());
      }, 500);

      // Reset tor status on open
      setTorStatus({ ip: null, isTor: null, proxy: null, toggleError: null, verifyError: null, loading: false, checkingToggle: false });
      if (activeCategory === 'networking') {
        fetchTorStatus();
      }

      return () => clearTimeout(timer);
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    if (isSettingsOpen && activeCategory === 'networking') {
      fetchTorStatus();
    }
  }, [activeCategory, isSettingsOpen, fetchTorStatus]);

  useEffect(() => {
    if (isSettingsOpen && activeCategory === 'mcp') {
        fetchMcpMeta();
    }
  }, [isSettingsOpen, activeCategory, fetchMcpMeta]);
  
  const currentPromptFormat = tempSettings.localLlmPromptFormat;
  const currentCustomTemplate = tempSettings.customPromptTemplates?.[currentPromptFormat] || '';
  const isPromptFormatEditable = !['openai-gemma2', 'jinja'].includes(currentPromptFormat);

  useEffect(() => {
      setPromptPreview(buildPromptPreview(currentPromptFormat, currentCustomTemplate));
  }, [currentPromptFormat, currentCustomTemplate]);

  const updateCustomPromptTemplate = (value: string) => {
      setTempSettings(prev => ({
          ...prev,
          customPromptTemplates: {
              ...(prev.customPromptTemplates || {}),
              [currentPromptFormat]: value,
          },
      }));
  };

  const handleSave = () => {
    updateGlobalSettings(tempSettings);
    closeSettingsModal();
  };
  
  const handleClearAllData = () => {
      if(window.confirm("Are you sure you want to delete ALL chats and knowledge? This action is irreversible.")) {
          clearAllChats();
          closeSettingsModal();
      }
  };

  const handleSettingChange = (key: keyof settingsStore.Settings, value: any) => {
    setTempSettings(prev => ({ ...prev, [key]: value }));
  };

  const runVoiceCommand = useCallback(async (target: 'piper' | 'whisper', action: 'start' | 'stop') => {
    const setStatus = target === 'piper' ? setPiperCommandStatus : setWhisperCommandStatus;
    const setLoading = target === 'piper' ? setPiperCommandLoading : setWhisperCommandLoading;
    const friendlyName = target === 'piper' ? 'Piper' : 'Whisper';
    setStatus(null);
    setLoading(true);
    try {
        const { settings, isRecoveryModeActive } = useStore.getState();
        if (!settings.proxyUrl) {
            throw new Error('Proxy URL is not configured. Update Networking settings first.');
        }
        const runner = target === 'piper'
            ? (action === 'start' ? voiceIntegrationService.startPiper : voiceIntegrationService.stopPiper)
            : (action === 'start' ? voiceIntegrationService.startWhisper : voiceIntegrationService.stopWhisper);
        const output = await runner(settings, isRecoveryModeActive);
        setStatus({
            message: output || `${friendlyName} ${action === 'start' ? 'started' : 'stopped'} successfully.`,
            isError: false,
        });
    } catch (error: any) {
        setStatus({
            message: error?.message || `${friendlyName} ${action === 'start' ? 'start' : 'stop'} failed.`,
            isError: true,
        });
    } finally {
        setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: string | number | boolean = value;

    if (type === 'number' || e.target.getAttribute('type') === 'number') {
        finalValue = value === '' ? 0 : parseFloat(value);
    } else if (type === 'checkbox') {
        finalValue = (e.target as HTMLInputElement).checked;
    }
    handleSettingChange(name as keyof settingsStore.Settings, finalValue);
  };
  
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      if (name === 'aiProvider' && value === 'dev') {
          // When switching to 'dev' provider, automatically set cloudProvider to 'openai'
          // as 'dev' is an alias for OpenAI-compatible experimentation.
          setTempSettings(prev => ({ ...prev, aiProvider: 'dev', cloudProvider: 'openai' }));
      } else {
          setTempSettings(prev => ({ ...prev, [name]: value }));
      }
  };

  const handleSocialCredChange = (platformId: SocialPlatformId, field: keyof PlatformCredentials, value: string) => {
        setTempSettings(prev => ({
            ...prev,
            socialIntegrations: {
                ...prev.socialIntegrations,
                [platformId]: {
                    ...prev.socialIntegrations[platformId],
                    [field]: value,
                }
            }
        }));
  };
  
  const handleSocialConnectToggle = (platformId: SocialPlatformId, shouldConnect: boolean) => {
        setTempSettings(prev => ({
            ...prev,
            socialIntegrations: {
                ...prev.socialIntegrations,
                [platformId]: {
                    ...prev.socialIntegrations[platformId],
                    connected: shouldConnect,
                }
            }
        }));
  };

  const handleAgentConfigChange = (agent: AgentRole, field: keyof AgentConfig, value: string) => {
    setTempSettings(prev => {
        const newSettings = { ...prev };
        // This type assertion is safe because we are controlling the inputs.
        (newSettings.multiAgentSettings.agents[agent] as any)[field] = value;
        return newSettings;
    });
  };

  const handleToggleTor = async (enabled: boolean) => {
    setTorStatus(prev => ({ ...prev, checkingToggle: true, toggleError: null }));
    try {
      const response = await fetch(`${tempSettings.proxyUrl}/proxy/settings/tor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to toggle Tor mode.');
      
      setTempSettings(prev => ({ ...prev, torModeEnabled: enabled }));
      setTorStatus(prev => ({ ...prev, proxy: data.proxy, ip: null, isTor: null, checkingToggle: false, toggleError: null, verifyError: null }));
    } catch (error: any) {
      setTorStatus(prev => ({ ...prev, toggleError: error.message, proxy: null, checkingToggle: false }));
    }
  };

  const handleVerifyTor = async () => {
    setTorStatus(prev => ({ ...prev, loading: true, verifyError: null, ip: null, isTor: null }));
    try {
      const response = await fetch(`${tempSettings.proxyUrl}/proxy/diag/tor`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed.');
      setTorStatus({ ...data, loading: false, toggleError: null, verifyError: null });
    } catch (error: any) {
      setTorStatus({ ip: null, isTor: null, proxy: null, loading: false, toggleError: null, verifyError: error.message });
    }
  };
  
  // --- Dev Provider Model Fetching ---
    const handleFetchModels = useCallback(async () => {
        if (!tempSettings.cloudApiUrl || !tempSettings.dev_openAiApiKey) {
            setFetchModelsError("Please enter both the Base URL and API Key.");
            return;
        }
        setIsFetchingModels(true);
        setFetchModelsError(null);
        setDevModels([]);

        const modelsUrl = `${tempSettings.cloudApiUrl.replace(/\/+$/, '')}/models`;

        try {
            const response = await fetch(modelsUrl, {
                headers: {
                    'Authorization': `Bearer ${tempSettings.dev_openAiApiKey}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
            }

            if (data.data && Array.isArray(data.data)) {
                const modelIds = data.data.map((m: any) => m.id).filter(Boolean);
                setDevModels(modelIds);
                if (modelIds.length > 0 && !modelIds.includes(tempSettings.model)) {
                    handleSettingChange('model', modelIds[0]);
                }
            } else {
                throw new Error("Invalid response format from model endpoint. Expected an object with a 'data' array.");
            }

        } catch (error: any) {
            setFetchModelsError(`Failed to fetch models: ${error.message}`);
        } finally {
            setIsFetchingModels(false);
        }
    }, [tempSettings.cloudApiUrl, tempSettings.dev_openAiApiKey, tempSettings.model]);
    
    const handleFetchAgentModels = useCallback(async (agent: AgentRole) => {
        const agentConfig = tempSettings.multiAgentSettings.agents[agent];
        if (!agentConfig.cloudApiUrl || !agentConfig.cloudApiKey) {
            setFetchAgentModelsError(prev => ({ ...prev, [agent]: "Please enter both the API Endpoint and API Key for this agent." }));
            return;
        }
        setIsFetchingAgentModels(prev => ({ ...prev, [agent]: true }));
        setFetchAgentModelsError(prev => ({ ...prev, [agent]: null }));
        setAgentModels(prev => ({ ...prev, [agent]: [] }));
    
        const modelsUrl = `${agentConfig.cloudApiUrl.replace(/\/+$/, '')}/models`;
    
        try {
            const response = await fetch(modelsUrl, {
                headers: { 'Authorization': `Bearer ${agentConfig.cloudApiKey}` }
            });
            const data = await response.json();
    
            if (!response.ok) {
                throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
            }
    
            if (data.data && Array.isArray(data.data)) {
                const modelIds = data.data.map((m: any) => m.id).filter(Boolean);
                setAgentModels(prev => ({ ...prev, [agent]: modelIds }));
                if (modelIds.length > 0 && !modelIds.includes(agentConfig.model)) {
                    handleAgentConfigChange(agent, 'model', modelIds[0]);
                }
            } else {
                throw new Error("Invalid response format from model endpoint. Expected an object with a 'data' array.");
            }
        } catch (error: any) {
            setFetchAgentModelsError(prev => ({ ...prev, [agent]: `Failed to fetch models: ${error.message}` }));
        } finally {
            setIsFetchingAgentModels(prev => ({ ...prev, [agent]: false }));
        }
    }, [tempSettings.multiAgentSettings]);

    useEffect(() => {
        // Reset dev models if the URL or key changes to prevent mismatches
        setDevModels([]);
        setFetchModelsError(null);
    }, [tempSettings.cloudApiUrl, tempSettings.dev_openAiApiKey]);


  const handleGoogleSignIn = () => googleAuthService.signIn();
  const handleGoogleSignOut = () => googleAuthService.signOut();

  const categories: { id: Category, name: string, icon: React.ReactNode }[] = [
    { id: 'general', name: 'General', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 010 1.885c-.008.379.137.752.43.992l1.003.827c.424.35.534.954.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.127c-.332.183-.582.495-.645.87l-.213 1.281c-.09.543-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.759 6.759 0 010 1.885c.008-.379-.137-.752-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37.49l1.217.456c.355.133.75.072 1.076.124.072-.044.146-.087.22-.127.332-.183.582-.495-.645-.87l.213-1.281z" /></svg> },
    { id: 'memory', name: 'Memory (RAG)', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg> },
    { id: 'model', name: 'AI Model', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5M15.75 3v1.5M15.75 21v-1.5M12 4.5v-1.5M12 21v-1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75h1.5v4.5h-1.5v-4.5zM6.75 9.75h1.5v4.5h-1.5v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.375 6.75h5.25a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25h-5.25a2.25 2.25 0 01-2.25-2.25v-6a2.25 2.25 0 012.25-2.25z" /></svg> },
    { id: 'multiAgent', name: 'Multi-agent', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.952a4.5 4.5 0 01-6.364-6.364v-.007A4.5 4.5 0 0110.5 9h.008a4.5 4.5 0 016.364 6.364v.007a4.5 4.5 0 01-6.364 6.364z" /></svg> },
    { id: 'mcp', name: 'MCP Server', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.65H8.228a3.375 3.375 0 00-3.285 2.65l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m15.46 0a4.5 4.5 0 01-6.41 2.122m-2.122-6.41a4.5 4.5 0 00-2.122-6.41m0 0a4.5 4.5 0 00-6.41 2.122m6.41 2.122a4.5 4.5 0 012.122 6.41M6.09 15.75a4.5 4.5 0 016.41-2.122m0 0a4.5 4.5 0 012.122-6.41m-8.532 8.532a4.5 4.5 0 006.41 2.122" /></svg> },
    { id: 'imageGeneration', name: 'Image Generation', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" /></svg> },
    { id: 'networking', name: 'Networking', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.953 11.953 0 0112 13.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 003 12c0 .778.099 1.533.284 2.253m18.232-4.5A11.953 11.953 0 0012 6c-2.998 0-5.74 1.1-7.843 2.918m15.686 0A8.959 8.959 0 0121 12" /></svg> },
    { id: 'voice', name: 'Voice', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 016 0v8.25a3 3 0 01-3 3z" /></svg> },
    { id: 'integrations', name: 'Google', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.0003 10.8443C11.3653 10.8443 10.8283 10.3073 10.8283 9.67231C10.8283 9.03731 11.3653 8.49931 12.0003 8.49931C12.6353 8.49931 13.1723 9.03731 13.1723 9.67231C13.1723 10.3073 12.6353 10.8443 12.0003 10.8443ZM12.0003 14.3293C13.5283 14.3293 15.5433 13.5513 15.5433 12.0123V11.1923C15.5233 11.1923 12.0203 12.1893 12.0003 12.1893C12.0003 12.1893 8.47734 11.1923 8.45634 11.1923V12.0123C8.45634 13.5513 10.4713 14.3293 12.0003 14.3293Z" /><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6.096C13.626 6.096 14.949 7.419 14.949 9.045C14.949 10.671 13.626 11.994 12 11.994C10.374 11.994 9.051 10.671 9.051 9.045C9.051 7.419 10.374 6.096 12 6.096ZM12 15.82C9.516 15.82 7.275 14.637 7.275 12.012V10.95C7.275 10.95 10.923 13.338 12 13.338C13.077 13.338 16.725 10.95 16.725 10.95V12.012C16.725 14.637 14.484 15.82 12 15.82Z" /></svg> },
    { id: 'social', name: 'Social Integrations', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.952a4.5 4.5 0 01-6.364-6.364v-.007A4.5 4.5 0 0110.5 9h.008a4.5 4.5 0 016.364 6.364v.007a4.5 4.5 0 01-6.364 6.364z" /></svg> },
    { id: 'debug', name: 'Data & Debug', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.375a6.375 6.375 0 006.375-6.375V9.75m-12 3.375c0-3.518 2.857-6.375 6.375-6.375V6.375m6.375 6.375v3.375c0 3.518-2.857 6.375-6.375-6.375m-6.375-6.375V9.75c0-3.518 2.857-6.375 6.375-6.375M3.375 9.75h17.25" /></svg> },
    { id: 'about', name: 'About', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  ];

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-0 md:p-4" onClick={closeSettingsModal}>
      <div 
        className="bg-base-100 rounded-none md:rounded-lg shadow-xl w-full h-full max-w-6xl flex flex-col md:flex-row overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <aside className="w-full md:w-64 bg-base-200 p-4 border-b md:border-b-0 md:border-r border-base-300 flex-shrink-0 overflow-y-auto">
          <h2 className="text-xl font-bold mb-6 text-base-content">Settings</h2>
          <ul className="space-y-1">
            {categories.map(cat => (
              <li key={cat.id}>
                <button 
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${activeCategory === cat.id ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}
                >
                  {cat.icon}
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeCategory === 'general' && (
                <div className="space-y-4">
                <SectionTitle>Appearance</SectionTitle>
                <SelectField label="Theme" name="theme" value={tempSettings.theme} onChange={handleSelectChange}>
                    {settingsStore.DAISYUI_THEMES.map(theme => <option key={theme} value={theme}>{theme.charAt(0).toUpperCase() + theme.slice(1)}</option>)}
                </SelectField>
                <Slider label="Font Size (px)" min={12} max={20} step={1} value={tempSettings.fontSize} name="fontSize" onChange={handleChange} />
                <Slider label="Sidebar Width (px)" min={200} max={500} step={8} value={tempSettings.sidebarWidth} name="sidebarWidth" onChange={handleChange} />
                <SelectField label="Message Density" name="messageDensity" value={tempSettings.messageDensity} onChange={handleSelectChange}>
                    <option value="cozy">Cozy</option>
                    <option value="compact">Compact</option>
                    <option value="ultra-compact">Ultra-Compact</option>
                </SelectField>
                
                <SectionTitle>Personalization</SectionTitle>
                <InputField label="Your Name / Title" name="userName" value={tempSettings.userName} onChange={handleChange} />
                <InputField label="Startup Greeting" name="startupGreeting" value={tempSettings.startupGreeting} onChange={handleChange} />
                
                <SectionTitle>Contact Information (Optional)</SectionTitle>
                <p className="text-xs text-base-content/70 -mt-2">This information can be used by the AI to fill in contact details for you, e.g., in emails.</p>
                <InputField label="Contact Email" name="contactEmail" type="email" value={tempSettings.contactEmail} onChange={handleChange} />
                <InputField label="Contact Phone" name="contactPhone" type="tel" value={tempSettings.contactPhone} onChange={handleChange} />
                <InputField label="Contact Address" name="contactAddress" value={tempSettings.contactAddress} onChange={handleChange} />
                </div>
            )}
            
            {activeCategory === 'memory' && (
                <div className="space-y-4">
                    <SectionTitle>Conversation Context</SectionTitle>
                    <Slider 
                        label="Context Window (Messages)" 
                        description="Maximum number of recent exchanges kept in the active conversation buffer." 
                        min={5} 
                        max={100} 
                        step={5} 
                        value={tempSettings.contextWindowSize} 
                        name="contextWindowSize" 
                        onChange={handleChange} 
                    />
                    <Slider 
                        label="Context Token Limit" 
                        description="Approximate token budget for the live context window. Older content beyond this limit is summarized into memory." 
                        min={256} 
                        max={4096} 
                        step={256} 
                        value={tempSettings.maxContextTokens} 
                        name="maxContextTokens" 
                        onChange={handleChange} 
                    />

                    <SectionTitle>Retrieval-Augmented Generation (RAG)</SectionTitle>
                    <ToggleSwitch
                        label="Enable RAG"
                        description="Allow the AI to search its knowledge base for relevant context before answering."
                        checked={tempSettings.ragEnabled}
                        onChange={(checked) => handleSettingChange('ragEnabled', checked)}
                    />
                    <ToggleSwitch
                        label="Use RAG for Attached Files"
                        description="When you attach a file in chat, embed it and retrieve relevant snippets instead of inlining the entire file into the prompt."
                        checked={tempSettings.useRagForAttachments}
                        onChange={(checked) => handleSettingChange('useRagForAttachments', checked)}
                        disabled={!tempSettings.ragEnabled}
                    />
                    <SelectField
                        label="Embedding Provider"
                        name="embeddingProvider"
                        value={tempSettings.embeddingProvider}
                        onChange={handleSelectChange}
                        description="Choose which service generates embeddings for RAG. 'Automatic' matches your main AI Provider."
                        disabled={!tempSettings.ragEnabled}
                    >
                        <option value="auto">Automatic (match AI Provider)</option>
                        <option value="local">Local LLM Server (Private)</option>
                        <option value="cloud">Cloud (Google Gemini)</option>
                    </SelectField>
                    <Slider label="Similarity Threshold" description="How closely a knowledge chunk must match the query to be included (0.0 to 1.0)." min={0} max={1} step={0.05} value={tempSettings.similarityThreshold} name="similarityThreshold" onChange={handleChange} disabled={!tempSettings.ragEnabled} />
                    <Slider label="Top K" description="The maximum number of relevant knowledge chunks to retrieve." min={1} max={20} step={1} value={tempSettings.topK} name="topK" onChange={handleChange} disabled={!tempSettings.ragEnabled} />

                    <SectionTitle>Chunking</SectionTitle>
                    <Slider label="Chunk Size (Tokens)" description="The target size for each text chunk when embedding a document." min={128} max={2048} step={64} value={tempSettings.chunkSize} name="chunkSize" onChange={handleChange} />
                    <Slider label="Chunk Overlap (Tokens)" description="How many tokens to overlap between consecutive chunks to maintain context." min={0} max={512} step={32} value={tempSettings.chunkOverlap} name="chunkOverlap" onChange={handleChange} />

                    <SectionTitle>Automatic Memory</SectionTitle>
                    <ToggleSwitch
                        label="Enable Automatic Memory"
                        description="Automatically summarize conversation history and save it to the knowledge base."
                        checked={tempSettings.enableAutoMemory}
                        onChange={(checked) => handleSettingChange('enableAutoMemory', checked)}
                    />
                    <Slider 
                        label="Auto-Memory Interval" 
                        description="Save memory automatically after this many messages." 
                        min={5} 
                        max={50} 
                        step={5} 
                        value={tempSettings.autoMemoryInterval} 
                        name="autoMemoryInterval" 
                        onChange={handleChange} 
                        disabled={!tempSettings.enableAutoMemory} 
                    />
                </div>
            )}

            {activeCategory === 'model' && (
                <div className="space-y-6">
                    <SectionTitle>AI Provider</SectionTitle>
                    <SelectField
                        label="Select AI Provider"
                        name="aiProvider"
                        value={tempSettings.aiProvider}
                        onChange={handleSelectChange}
                        description="Choose between a local, private LLM or a cloud-based service."
                    >
                        <option value="localLlm">Local LLM (Private & Offline)</option>
                        <option value="cloud">Cloud Provider (Gemini, OpenAI, etc.)</option>
                        <option value="dev">Dev Provider (Experimental OpenAI)</option>
                    </SelectField>
                    
                    <ToggleSwitch
                        label="Developer Mode"
                        description="Shows all model settings and bypasses provider-specific restrictions for testing."
                        checked={tempSettings.developerMode}
                        onChange={(checked) => handleSettingChange('developerMode', checked)}
                    />
                    
                    {(tempSettings.aiProvider === 'localLlm' || tempSettings.developerMode) && (
                    <CollapsibleSection title="Local AI Server Configuration" defaultOpen={tempSettings.aiProvider === 'localLlm' || tempSettings.developerMode}>
                        <InputField
                            label="Chat Server URL"
                            description="The base URL of your local inference server for chat completions (e.g., http://localhost:8080)."
                            name="localLlmUrl"
                            value={tempSettings.localLlmUrl}
                            onChange={handleChange}
                            placeholder="http://localhost:8080"
                        />
                        <InputField
                            label="Embedding Server URL (Optional)"
                            description="URL for the embedding model server. If blank, the Chat Server URL will be used."
                            name="localLlmEmbeddingUrl"
                            value={tempSettings.localLlmEmbeddingUrl}
                            onChange={handleChange}
                            placeholder="http://localhost:8080"
                        />
                        <InputField
                            label="Chat Model Name"
                            description="The model file name or identifier used for chat completions (e.g., mistral-7b-instruct-v0.2.Q4_K_M.gguf)."
                            name="localLlmModelName"
                            value={tempSettings.localLlmModelName}
                            onChange={handleChange}
                        />
                        <InputField
                            label="Embedding Model Name"
                            description="The model file name used for generating embeddings for RAG."
                            name="localLlmEmbeddingModel"
                            value={tempSettings.localLlmEmbeddingModel}
                            onChange={handleChange}
                        />
                        <div className="opacity-60 pointer-events-none">
                            <SelectField
                                label="Prompt Format (Legacy)"
                                name="localLlmPromptFormat"
                                value={tempSettings.localLlmPromptFormat}
                                onChange={handleSelectChange}
                                description="Legacy setting; llama.cpp chat_template now formats requests automatically."
                            >
                                <option value="jinja">Jinja chat_template (default: let server handle formatting)</option>
                                <option value="openai-gemma2">OpenAI-Compatible</option>
                                <option value="gpt-oss">GPT-OSS</option>
                                <option value="llama3">Llama 3 Instruct</option>
                                <option value="chatml">ChatML</option>
                                <option value="mirothinker">MiroThinker</option>
                                <option value="gemma">Gemma Instruct</option>
                                <option value="deepseek-coder">Deepseek Coder</option>
                            </SelectField>
                            <div className="text-xs text-base-content/60 p-2 bg-base-200 rounded-md">
                                <p className="font-semibold mb-1">Prompt Preview (Legacy):</p>
                                <pre className="whitespace-pre-wrap font-mono text-xs">{promptPreview}</pre>
                                <p className="mt-2">Note: This format is ignored when using llama.cpp chat_template.</p>
                            </div>
                            {isPromptFormatEditable ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-base-content/70">Custom Prompt Template (Legacy)</label>
                                    <textarea
                                        className="textarea textarea-bordered w-full h-32 font-mono text-xs"
                                        placeholder="Use {{system}}, {{messages}}, or {{latest_user}} placeholders to customize the format."
                                        value={currentCustomTemplate}
                                        onChange={(e) => updateCustomPromptTemplate(e.target.value)}
                                        disabled
                                    />
                                    <div className="flex items-center justify-between text-xs text-base-content/60">
                                        <p>{CUSTOM_PROMPT_TEMPLATE_HELP}</p>
                                        {currentCustomTemplate && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => updateCustomPromptTemplate('')}
                                                disabled
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-base-content/60 bg-base-200 rounded-md p-2">
                                    Custom templates are disabled (legacy).
                                </p>
                            )}
                        </div>
                        <InputField
                            label="Keep-Alive Time"
                            description="How long the model should stay loaded in memory after a request (e.g., 5m, 1h, forever)."
                            name="modelKeepAlive"
                            value={tempSettings.modelKeepAlive}
                            onChange={handleChange}
                        />
                        <InputField
                            label="Custom Headers (JSON)"
                            description="Add custom HTTP headers for your local server requests (e.g., for authentication)."
                            name="customHeaders"
                            value={tempSettings.customHeaders}
                            onChange={handleChange}
                            placeholder='{ "Authorization": "Bearer your_token" }'
                        />

                        <CollapsibleSection title="Advanced Prompting">
                            <InputField label="Anti-Prompt (Reverse Prompt)" name="antiPrompt" value={tempSettings.antiPrompt} onChange={handleChange} description="Comma-separated list of strings to stop generation at." placeholder="User:, Human:, ###" />
                            <InputField label="Input Prefix" name="inputPrefix" value={tempSettings.inputPrefix} onChange={handleChange} description="Text to insert before the user's prompt." />
                            <InputField label="Input Suffix" name="inputSuffix" value={tempSettings.inputSuffix} onChange={handleChange} description="Text to insert after the user's prompt, before the AI's response." />
                            <ToggleSwitch label="Cache Prompt" description="Cache the prompt to speed up processing for long prompts. May cause issues with some models." checked={tempSettings.cachePrompt} onChange={(c) => handleSettingChange('cachePrompt', c)} />
                        </CollapsibleSection>

                        <CollapsibleSection title="Performance Tuning (llama.cpp)">
                             <InputField label="Context Length (n_ctx)" name="contextLength" type="number" value={tempSettings.contextLength} onChange={handleChange} description="The maximum context size for the model." />
                             <InputField label="GPU Layers (n_gpu_layers)" name="gpuLayers" type="number" value={tempSettings.gpuLayers} onChange={handleChange} description="Number of model layers to offload to the GPU. -1 for all." />
                             <InputField label="Threads (n_threads)" name="threads" type="number" value={tempSettings.threads} onChange={handleChange} description="Number of CPU threads to use. 0 for auto." />
                             <InputField label="Batch Size (n_batch)" name="batchSize" type="number" value={tempSettings.batchSize} onChange={handleChange} description="Batch size for prompt processing." />
                             <InputField label="Keep Tokens (n_keep)" name="nKeep" type="number" value={tempSettings.nKeep} onChange={handleChange} description="Number of tokens from the start of the context to keep." />
                             <ToggleSwitch label="Use MMAP" description="Use memory-mapped files for faster model loading." checked={tempSettings.useMmap} onChange={(c) => handleSettingChange('useMmap', c)} />
                             <ToggleSwitch label="Use MLOCK" description="Force the model to stay in RAM to prevent swapping." checked={tempSettings.useMlock} onChange={(c) => handleSettingChange('useMlock', c)} />
                             <ToggleSwitch label="Low VRAM" description="Reduce VRAM usage at the cost of performance." checked={tempSettings.lowVram} onChange={(c) => handleSettingChange('lowVram', c)} />
                             <InputField label="Rope Freq Base" name="ropeFrequencyBase" type="number" value={tempSettings.ropeFrequencyBase} onChange={handleChange} description="RoPE base frequency. 0 for model default." />
                             <InputField label="Rope Freq Scale" name="ropeFrequencyScale" type="number" value={tempSettings.ropeFrequencyScale} onChange={handleChange} description="RoPE frequency scaling factor. 0 for model default." />
                        </CollapsibleSection>

                        <CollapsibleSection title="Debugging & Advanced">
                             <InputField label="Grammar (GBNF)" description="Constrain model output to a specific formal grammar (e.g., for JSON mode). Leave empty to disable." name="grammar" value={tempSettings.grammar} onChange={handleChange} placeholder='root ::= "{" "key" ":" "\"" "value" "\"" "}"' />
                             <InputField label="Logit Bias (JSON)" name="logitBias" value={tempSettings.logitBias} onChange={handleChange} description="JSON string to bias the model towards or against certain tokens." placeholder='{ "123": -1.0, "456": 2.0 }' />
                             <InputField label="Logprobs" name="logprobs" type="number" value={tempSettings.logprobs} onChange={handleChange} description="Number of top tokens to return log probabilities for." />
                             <ToggleSwitch label="Perplexity" description="Calculate and return the perplexity of the generated text." checked={tempSettings.perplexity} onChange={(c) => handleSettingChange('perplexity', c)} />
                             <InputField label="Slot ID" name="slotId" type="number" value={tempSettings.slotId} onChange={handleChange} description="Assign the request to a specific processing slot (-1 for auto)." />
                        </CollapsibleSection>
                    </CollapsibleSection>
                    )}
                    
                    {(tempSettings.aiProvider === 'cloud' || tempSettings.aiProvider === 'dev' || tempSettings.developerMode) && (
                    <CollapsibleSection title="Cloud Provider Configuration" defaultOpen={tempSettings.aiProvider === 'cloud' || tempSettings.aiProvider === 'dev' || tempSettings.developerMode}>
                        <p className="text-xs text-base-content/70 -mt-2 mb-4">
                            Settings for connecting to a cloud-based AI service like Google Gemini or an OpenAI-compatible API.
                            {(tempSettings.aiProvider === 'localLlm' && !tempSettings.developerMode) && <span className="text-warning font-bold"> (Currently Inactive)</span>}
                        </p>
                        {!tempSettings.developerMode ? (
                            <KeyStatus label="Cloud API Key" isSet={cloudApiKeyIsSet} envVar="API_KEY" />
                        ) : (
                            <>
                                {tempSettings.cloudProvider === 'gemini' ? (
                                    <InputField
                                        label="Gemini API Key (Dev Mode)"
                                        description="Enter Gemini API key directly. Bypasses .env for testing."
                                        name="dev_geminiApiKey"
                                        type="password"
                                        value={tempSettings.dev_geminiApiKey}
                                        onChange={handleChange}
                                    />
                                ) : (
                                    <InputField
                                        label="OpenAI-Compatible API Key (Dev Mode)"
                                        description="Enter API key directly. Bypasses .env for testing."
                                        name="dev_openAiApiKey"
                                        type="password"
                                        value={tempSettings.dev_openAiApiKey}
                                        onChange={handleChange}
                                    />
                                )}
                            </>
                        )}

                        <SelectField
                            label="Cloud Provider Type"
                            name="cloudProvider"
                            value={tempSettings.cloudProvider}
                            onChange={handleSelectChange}
                            description="Select the type of cloud service you are using."
                            disabled={tempSettings.aiProvider === 'dev'}
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI-Compatible</option>
                        </SelectField>
                        
                        {(tempSettings.aiProvider === 'dev' || tempSettings.cloudProvider === 'openai') && (
                            <InputField
                                label="OpenAI-Compatible Base URL"
                                description="The base URL for your OpenAI-compatible service (e.g., https://api.openai.com/v1)."
                                name="cloudApiUrl"
                                value={tempSettings.cloudApiUrl}
                                onChange={handleChange}
                            />
                        )}
                        
                        {tempSettings.aiProvider === 'dev' ? (
                             <div className="space-y-2">
                                <label className="font-medium text-base-content block mb-1">Cloud Model Name</label>
                                <p className="text-xs text-base-content/70 mb-2">Enter a model name manually, or fetch the list of available models from your endpoint.</p>
                                <div className="flex items-center gap-2">
                                    {devModels.length > 0 ? (
                                        <SelectField label="" name="model" value={tempSettings.model} onChange={e => handleSettingChange('model', e.target.value)} description="">
                                            {devModels.map(modelId => <option key={modelId} value={modelId}>{modelId}</option>)}
                                        </SelectField>
                                    ) : (
                                        <InputField label="" name="model" value={tempSettings.model} onChange={handleChange} description="" />
                                    )}
                                    <button type="button" onClick={handleFetchModels} className="btn btn-secondary btn-sm flex-shrink-0" disabled={isFetchingModels}>
                                        {isFetchingModels && <span className="loading loading-spinner loading-xs"></span>}
                                        Fetch Models
                                    </button>
                                </div>
                                {fetchModelsError && <p className="text-error text-xs mt-1">{fetchModelsError}</p>}
                            </div>
                        ) : (
                             <InputField
                                label="Cloud Model Name"
                                description="The model name to use with the selected cloud provider."
                                name="model"
                                value={tempSettings.model}
                                onChange={handleChange}
                            />
                        )}
                        
                        {tempSettings.cloudProvider === 'gemini' && (
                            <InputField
                                label="Gemini Embedding Model"
                                description="The embedding model to use for RAG with Gemini."
                                name="geminiEmbeddingModel"
                                value={tempSettings.geminiEmbeddingModel}
                                onChange={handleChange}
                            />
                        )}
                         <ToggleSwitch
                            label="Enable Thinking Mode (Gemini)"
                            description="Allow the model to perform 'thinking' before answering for higher quality. May increase latency."
                            checked={tempSettings.enableThinking}
                            onChange={(checked) => handleSettingChange('enableThinking', checked)}
                        />
                        <Slider
                            label="Thinking Budget"
                            description="Max tokens for thinking. High values improve reasoning but can increase latency/cost."
                            min={0} max={24576} step={1024}
                            value={tempSettings.thinkingBudget}
                            name="thinkingBudget"
                            onChange={handleChange}
                            disabled={!tempSettings.enableThinking && !tempSettings.developerMode}
                        />
                    </CollapsibleSection>
                    )}

                    <CollapsibleSection title="Shared Model Parameters">
                        <p className="text-xs text-base-content/70 -mt-2 mb-4">These parameters are applied to both local and cloud models where supported.</p>
                        <Slider label="Max Output Tokens" description="Maximum number of tokens to generate in a single response." min={0} max={100000} step={512} value={tempSettings.maxOutputTokens} name="maxOutputTokens" onChange={handleChange} />
                        <Slider label="Temperature" description="Controls randomness. Lower values are more deterministic, higher are more creative." min={0} max={2} step={0.1} value={tempSettings.temperature} name="temperature" onChange={handleChange} />
                        <Slider label="Top P" description="Nucleus sampling. The model considers tokens with probabilities summing up to this value." min={0} max={1} step={0.05} value={tempSettings.topP} name="topP" onChange={handleChange} />
                        <Slider label="Top K" description="The model considers the top K most likely tokens at each step." min={0} max={100} step={1} value={tempSettings.modelTopK} name="modelTopK" onChange={handleChange} />
                        <Slider label="Repetition Penalty" description="Penalizes recently used tokens to discourage repetition. >1 is a penalty, <1 is a reward." min={0} max={2} step={0.05} value={tempSettings.repetitionPenalty} name="repetitionPenalty" onChange={handleChange} />
                        <Slider label="Frequency Penalty" description="Penalizes tokens based on how often they appear in the text so far." min={-2.0} max={2.0} step={0.1} value={tempSettings.frequencyPenalty} name="frequencyPenalty" onChange={handleChange} />
                        <Slider label="Presence Penalty" description="Penalizes tokens if they have appeared in the text at all." min={-2.0} max={2.0} step={0.1} value={tempSettings.presencePenalty} name="presencePenalty" onChange={handleChange} />
                        <InputField label="Stop Tokens" description="Comma-separated list of tokens that will stop generation." name="stopTokens" value={tempSettings.stopTokens} onChange={handleChange} placeholder="<|im_end|>, ###" />
                        <InputField label="Seed" name="seed" type="number" value={tempSettings.seed} onChange={handleChange} description="Set a seed for reproducible results. -1 for random." />
                    </CollapsibleSection>
                </div>
            )}
            
            {activeCategory === 'multiAgent' && (
                <div className="space-y-6">
                    <SectionTitle>Multi-agent System</SectionTitle>
                    <ToggleSwitch
                        label="Enable Multi-agent System"
                        description="Activate the multi-agent framework for complex task orchestration."
                        checked={tempSettings.multiAgentSettings.enabled}
                        onChange={(checked) => setTempSettings(prev => ({
                            ...prev,
                            multiAgentSettings: { ...prev.multiAgentSettings, enabled: checked }
                        }))}
                    />

                    <div className={`space-y-4 transition-opacity ${!tempSettings.multiAgentSettings.enabled ? 'opacity-50' : ''}`}>
                        {AGENT_ROLES.map(agent => (
                            <CollapsibleSection key={agent} title={`${agent} Agent Configuration`}>
                                <div className="space-y-4">
                                    <SelectField
                                        label="Provider"
                                        name={`${agent}-provider`}
                                        value={tempSettings.multiAgentSettings.agents[agent].provider}
                                        onChange={(e) => handleAgentConfigChange(agent, 'provider', e.target.value)}
                                        disabled={!tempSettings.multiAgentSettings.enabled}
                                    >
                                        <option value="localLlm">Local LLM</option>
                                        <option value="cloud">Cloud Provider</option>
                                    </SelectField>

                                    {tempSettings.multiAgentSettings.agents[agent].provider === 'localLlm' && (
                                        <InputField
                                            label="Local LLM Port"
                                            name={`${agent}-localLlmPort`}
                                            value={tempSettings.multiAgentSettings.agents[agent].localLlmPort}
                                            onChange={(e) => handleAgentConfigChange(agent, 'localLlmPort', e.target.value)}
                                            placeholder="e.g., 8081"
                                            disabled={!tempSettings.multiAgentSettings.enabled}
                                        />
                                    )}

                                    {tempSettings.multiAgentSettings.agents[agent].provider === 'cloud' && (
                                        tempSettings.developerMode ? (
                                            <>
                                                <InputField
                                                    label="Cloud API Endpoint"
                                                    name={`${agent}-cloudApiUrl`}
                                                    value={tempSettings.multiAgentSettings.agents[agent].cloudApiUrl}
                                                    onChange={(e) => handleAgentConfigChange(agent, 'cloudApiUrl', e.target.value)}
                                                    placeholder="e.g., https://api.openai.com/v1"
                                                    disabled={!tempSettings.multiAgentSettings.enabled}
                                                />
                                                <InputField
                                                    label="Cloud API Key (Dev Mode)"
                                                    name={`${agent}-cloudApiKey`}
                                                    type="password"
                                                    value={tempSettings.multiAgentSettings.agents[agent].cloudApiKey}
                                                    onChange={(e) => handleAgentConfigChange(agent, 'cloudApiKey', e.target.value)}
                                                    disabled={!tempSettings.multiAgentSettings.enabled}
                                                />
                                                <div className="space-y-2">
                                                    <label className="font-medium text-base-content block mb-1">Cloud Model Name</label>
                                                    <div className="flex items-center gap-2">
                                                        {(agentModels[agent] && agentModels[agent].length > 0) ? (
                                                            <SelectField label="" name={`${agent}-model`} value={tempSettings.multiAgentSettings.agents[agent].model} onChange={e => handleAgentConfigChange(agent, 'model', e.target.value)} description="">
                                                                {agentModels[agent].map(modelId => <option key={modelId} value={modelId}>{modelId}</option>)}
                                                            </SelectField>
                                                        ) : (
                                                            <InputField label="" name={`${agent}-model`} value={tempSettings.multiAgentSettings.agents[agent].model} onChange={e => handleAgentConfigChange(agent, 'model', e.target.value)} description="" />
                                                        )}
                                                        <button type="button" onClick={() => handleFetchAgentModels(agent)} className="btn btn-secondary btn-sm flex-shrink-0" disabled={isFetchingAgentModels[agent]}>
                                                            {isFetchingAgentModels[agent] && <span className="loading loading-spinner loading-xs"></span>}
                                                            Fetch Models
                                                        </button>
                                                    </div>
                                                    {fetchAgentModelsError[agent] && <p className="text-error text-xs mt-1">{fetchAgentModelsError[agent]}</p>}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-base-content/70 p-2 bg-base-200 rounded-md">
                                                This agent will use the main Cloud Provider configuration. Enable Developer Mode to override.
                                            </p>
                                        )
                                    )}

                                    <div>
                                        <label htmlFor={`${agent}-systemPrompt`} className="font-medium text-base-content block mb-1">System Prompt</label>
                                        <p className="text-xs text-base-content/70 mb-2">The core instructions that define this agent's personality and task.</p>
                                        <textarea
                                            id={`${agent}-systemPrompt`}
                                            name={`${agent}-systemPrompt`}
                                            rows={6}
                                            className="w-full p-2 rounded-md bg-base-200 border border-base-300 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 font-mono text-xs"
                                            value={tempSettings.multiAgentSettings.agents[agent].systemPrompt}
                                            onChange={(e) => handleAgentConfigChange(agent, 'systemPrompt', e.target.value)}
                                            disabled={!tempSettings.multiAgentSettings.enabled}
                                        />
                                    </div>
                                </div>
                            </CollapsibleSection>
                        ))}
                    </div>
                </div>
            )}
            
            {activeCategory === 'mcp' && (
                <div className="space-y-6">
                    <SectionTitle>Modular Command Platform (MCP)</SectionTitle>
                    <p className="text-sm text-base-content/70 -mt-2">
                        MCP servers are configured on the backend registry and auto-discovered through the proxy. This UI is read-only; edit <code>backend/mcp/master.json</code> to change servers.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchMcpMeta}
                            className="btn btn-secondary btn-sm"
                            disabled={isFetchingMcp}
                        >
                            {isFetchingMcp && <span className="loading loading-spinner loading-xs mr-1" />}
                            Refresh Status
                        </button>
                        <div className="text-sm text-base-content/70">
                            Tools discovered: <span className="font-semibold text-base-content">{mcpTools.length}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {mcpStatuses.length === 0 && (
                            <div className="p-3 rounded-md bg-base-200 text-sm text-base-content/70">
                                No MCP servers reported by the proxy yet.
                            </div>
                        )}
                        {mcpStatuses.map(status => {
                            const isError = status.status !== 'connected';
                            return (
                                <div key={status.name} className="p-3 rounded-md border border-base-300 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-3 h-3 rounded-full ${isError ? 'bg-error' : 'bg-success'}`} aria-label={status.status}></span>
                                        <div>
                                            <div className="font-semibold text-base-content">{status.name}</div>
                                            <div className="text-xs text-base-content/70">
                                                {status.status}{status.error ? ` — ${status.error}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded bg-base-200 uppercase tracking-wide text-base-content/70">
                                        {status.status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}


            {activeCategory === 'imageGeneration' && (
                <div className="space-y-6">
                    <SectionTitle>Image Generation Provider</SectionTitle>
                    <SelectField
                        label="Select Image Generation Provider"
                        name="imageGenerationProvider"
                        value={tempSettings.imageGenerationProvider}
                        onChange={handleSelectChange}
                        description="Choose the service to use for the 'generate image' command. This is independent of your main AI provider."
                    >
                        <option value="none">Disabled</option>
                        <option value="gemini">Google Gemini (Imagen)</option>
                        <option value="openai">OpenAI-Compatible (DALL-E, etc.)</option>
                        <option value="local">Local Model (API)</option>
                    </SelectField>

                    {(tempSettings.imageGenerationProvider === 'gemini' || tempSettings.imageGenerationProvider === 'openai') && (
                        <>
                            {!tempSettings.developerMode ? (
                                <KeyStatus label="Cloud API Key" isSet={cloudApiKeyIsSet} envVar="API_KEY" />
                            ) : (
                                <>
                                    {tempSettings.imageGenerationProvider === 'gemini' ? (
                                        <InputField
                                            label="Gemini API Key (Dev Mode)"
                                            description="Enter Gemini API key directly. Bypasses .env for testing."
                                            name="dev_geminiApiKey"
                                            type="password"
                                            value={tempSettings.dev_geminiApiKey}
                                            onChange={handleChange}
                                        />
                                    ) : (
                                        <InputField
                                            label="OpenAI-Compatible API Key (Dev Mode)"
                                            description="Enter API key directly. Bypasses .env for testing."
                                            name="dev_openAiApiKey"
                                            type="password"
                                            value={tempSettings.dev_openAiApiKey}
                                            onChange={handleChange}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}
                    
                    {(tempSettings.imageGenerationProvider === 'openai' || tempSettings.imageGenerationProvider === 'local') && (
                        <>
                            <InputField
                                label="API Endpoint URL"
                                name="imageGenerationUrl"
                                value={tempSettings.imageGenerationUrl}
                                onChange={handleChange}
                                placeholder={
                                    tempSettings.imageGenerationProvider === 'openai' 
                                    ? "https://api.openai.com/v1/images/generations" 
                                    : "http://127.0.0.1:7860/sdapi/v1/txt2img"
                                }
                            />
                            <InputField
                                label="Model Name"
                                name="imageGenerationModel"
                                value={tempSettings.imageGenerationModel}
                                onChange={handleChange}
                                placeholder={
                                    tempSettings.imageGenerationProvider === 'openai' 
                                    ? "dall-e-3" 
                                    : "sd_xl_base_1.0.safetensors"
                                }
                            />
                        </>
                    )}
                </div>
            )}

            {activeCategory === 'networking' && (
                <div className="space-y-4">
                    <SectionTitle>Proxies</SectionTitle>
          <InputField
            label="Local Proxy URL"
            name="proxyUrl"
            value={tempSettings.proxyUrl}
            onChange={handleChange}
            type="text"
            placeholder="http://localhost:3001"
            description="Auto tries the local proxy first, then falls back to the remote/CORS proxy if it fails."
          />
                    <SelectField
                        label="Proxy Mode"
                        description="Auto tries the local proxy first, then falls back to the remote/CORS proxy if it fails."
                        name="proxyMode"
                        value={tempSettings.proxyMode}
                        onChange={handleSelectChange}
                    >
                        <option value="auto">Auto (local + remote fallback)</option>
                        <option value="local">Local only (requires ./start.sh)</option>
                        <option value="remote">Remote CORS proxy only</option>
                    </SelectField>
                    <InputField
                        label="Remote / CORS Proxy URL"
                        description="Used when proxy mode is Remote or as the fallback target in Auto mode. Include {{URL}} or {{RAW}} to control encoding (default behavior URL-encodes the target when no placeholder is provided)."
                        name="corsProxyUrl"
                        value={tempSettings.corsProxyUrl}
                        onChange={handleChange}
                    />
                    <InputField
                        label="Curl User-Agent"
                        description="The User-Agent string to send with `curl` requests via the proxy."
                        name="curlUserAgent"
                        value={tempSettings.curlUserAgent}
                        onChange={handleChange}
                    />

                    <SectionTitle>Web Scraping</SectionTitle>
                    <SelectField
                        label="Scraping Provider"
                        name="webScrapingProvider"
                        value={tempSettings.webScrapingProvider || "auto"}
                        onChange={handleSelectChange}
                    >
                        <option value="auto">Auto (Tavily &gt; Jina &gt; Raw)</option>
                        <option value="scrapestack">Scrapestack (Legacy)</option>
                    </SelectField>

                    {tempSettings.webScrapingProvider === 'scrapestack' && (
                        <div>
                            <InputField
                                label="Scrapestack API Key"
                                description="API key for the `webscrape` tool. Get one from scrapestack.com."
                                name="scrapestackApiKey"
                                type="password"
                                value={tempSettings.scrapestackApiKey}
                                onChange={handleChange}
                                disabled={!tempSettings.developerMode}
                            />
                            {!tempSettings.developerMode && (
                                <p className="text-xs text-warning -mt-3 px-1">
                                    Enable <button type="button" className="font-bold link link-hover" onClick={() => setActiveCategory('model')}>Developer Mode</button> (in AI Model settings) to add API keys.
                                </p>
                            )}
                        </div>
                    )}

                    {tempSettings.searchEngine === 'tavily' && (
                        <InputField
                            label="Tavily API Key"
                            description="Get a free key from tavily.com. High-quality, deep search results optimized for AI agents."
                            name="tavilyApiKey"
                            type="password"
                            value={tempSettings.tavilyApiKey}
                            onChange={handleChange}
                        />
                    )}

                    <SectionTitle>Web Search</SectionTitle>
                    <SelectField
                        label="Search Engine"
                        name="searchEngine"
                        value={tempSettings.searchEngine}
                        onChange={handleSelectChange}
                    >
                        <option value="duckduckgo">DuckDuckGo (HTML)</option>
                        <option value="google">Google (Custom Search API)</option>
                        <option value="tavily">Tavily AI (Recommended)</option>
                        <option value="brave">Brave (Link Only)</option>
                        <option value="custom">Custom Endpoint</option>
                    </SelectField>
                    {tempSettings.searchEngine === 'google' && (
                        <div className="space-y-4 p-4 bg-base-200 rounded-md">
                            {!tempSettings.developerMode ? (
                                <KeyStatus label="Google Developer API Key" isSet={googleDevApiKeyIsSet} envVar="GOOGLE_API_DEVELOPER_KEY" />
                            ) : (
                                <InputField
                                    label="Google Developer API Key (Dev Mode)"
                                    description="Enter API key directly. Bypasses .env for testing."
                                    name="dev_googleDeveloperApiKey"
                                    type="password"
                                    value={tempSettings.dev_googleDeveloperApiKey}
                                    onChange={handleChange}
                                />
                            )}
                            <InputField
                                label="Google Programmable Search Engine ID (CX ID)"
                                name="googleSearchCxId"
                                value={tempSettings.googleSearchCxId}
                                onChange={handleChange}
                            />
                        </div>
                    )}
                    {tempSettings.searchEngine === 'custom' && (
                        <InputField
                            label="Custom Search API Endpoint"
                            description="Enter the full URL. Use {{QUERY}} as a placeholder for the search query."
                            name="customSearchApiEndpoint"
                            value={tempSettings.customSearchApiEndpoint}
                            onChange={handleChange}
                        />
                    )}

                    <SectionTitle>Tor Anonymity</SectionTitle>
                    <div className="space-y-4 p-4 bg-base-200 rounded-lg border border-base-300">
                        <div className="space-y-2">
                            {torStatus.checkingToggle ? (
                                <div className="flex items-center justify-between p-2 bg-base-300/50 rounded-md animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <span className="loading loading-spinner loading-sm"></span>
                                        <div>
                                            <label className="font-medium text-base-content">Connecting to Tor...</label>
                                            <p className="text-xs text-base-content/70">Attempting to find a local proxy. This may take a moment.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="font-medium text-base-content">Enable Tor Mode</label>
                                            <p className="text-xs text-base-content/70">Route all backend network requests through a local Tor SOCKS proxy (9050 or 9150).</p>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="toggle toggle-primary" 
                                            checked={tempSettings.torModeEnabled} 
                                            onChange={(e) => handleToggleTor(e.target.checked)} 
                                        />
                                    </div>
                                    {torStatus.toggleError && (
                                        <div className="mt-2 text-error text-xs p-2 bg-error/10 rounded-md border border-error/20">
                                            <strong>Connection Failed:</strong> {torStatus.toggleError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={handleVerifyTor} disabled={torStatus.loading} className="btn btn-sm btn-outline">
                                {torStatus.loading && <span className="loading loading-spinner loading-xs"></span>}
                                Verify Connection
                            </button>
                            <div className="text-xs text-base-content/70">
                            {torStatus.verifyError && <p className="text-error">Error: {torStatus.verifyError}</p>}
                            {torStatus.ip && (
                                <p>
                                    <span className="font-bold">Exit IP:</span> {torStatus.ip} |{' '}
                                    <span className="font-bold">Proxy:</span> {torStatus.proxy || 'N/A'} |{' '}
                                    <span className={`font-bold ${torStatus.isTor ? 'text-success' : 'text-warning'}`}>
                                        Tor Network: {torStatus.isTor ? 'Yes' : 'No'}
                                    </span>
                                </p>
                            )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
            
            {activeCategory === 'voice' && (
                <div className="space-y-6">
                    <SectionTitle>Voice & Speech</SectionTitle>
                    <ToggleSwitch
                        label="Enable Voice Features"
                        description="Master switch to enable microphone input and text-to-speech capabilities."
                        checked={tempSettings.voiceEnabled}
                        onChange={(checked) => handleSettingChange('voiceEnabled', checked)}
                    />

                    <CollapsibleSection title="Text-to-Speech (TTS) Configuration" defaultOpen>
                        <SelectField
                            label="TTS Provider"
                            name="ttsProvider"
                            value={tempSettings.ttsProvider}
                            onChange={handleSelectChange}
                            description="Choose the engine that will convert text to speech."
                            disabled={!tempSettings.voiceEnabled}
                        >
                            <option value="browser">Browser (Built-in)</option>
                            <option value="piper">Piper (Self-Hosted)</option>
                            <option value="systemPiper">Piper Script (Local)</option>
                        </SelectField>

                        {tempSettings.ttsProvider === 'browser' && (
                            <SelectField
                                label="Browser Voice"
                                name="ttsVoiceName"
                                value={tempSettings.ttsVoiceName}
                                onChange={handleSelectChange}
                                disabled={!tempSettings.voiceEnabled || availableVoices.length === 0}
                                description="Select a voice from the list provided by your web browser."
                            >
                                {availableVoices.length === 0 && <option>Loading voices...</option>}
                                {availableVoices.map(voice => (
                                    <option key={voice.name} value={voice.name}>{voice.name} ({voice.lang})</option>
                                ))}
                            </SelectField>
                        )}

                        {tempSettings.ttsProvider === 'piper' && (
                            <InputField
                                label="Piper Server URL"
                                name="piperTtsUrl"
                                value={tempSettings.piperTtsUrl}
                                onChange={handleChange}
                                placeholder="http://localhost:5002"
                                description="Enter the URL of your self-hosted Piper TTS server."
                                disabled={!tempSettings.voiceEnabled}
                            />
                        )}
                        {tempSettings.ttsProvider === 'systemPiper' && (
                            <div className="text-xs text-base-content/70 bg-base-200 p-3 rounded-md border border-base-300">
                                Uses <code>scripts/voice/piper_say.sh</code> via the local proxy. Configure <code>PIPER_MODEL</code>,
                                <code>PIPER_VENV</code>, or related env vars before launching <code>start.sh</code>.
                            </div>
                        )}
                        <ToggleSwitch
                            label="Automatically Read Responses Aloud"
                            description="Enable text-to-speech for all AI responses using the selected provider."
                            checked={tempSettings.readAloud}
                            onChange={(checked) => handleSettingChange('readAloud', checked)}
                            disabled={!tempSettings.voiceEnabled}
                        />
                    </CollapsibleSection>
                    
                    <CollapsibleSection title="Speech-to-Text (STT) Configuration">
                        <SelectField
                            label="STT Provider"
                            name="sttProvider"
                            value={tempSettings.sttProvider}
                            onChange={handleSelectChange}
                            description="Choose the engine that will convert your speech to text."
                            disabled={!tempSettings.voiceEnabled}
                        >
                            <option value="browser">Browser (Built-in)</option>
                            <option value="vosk">Vosk (Self-Hosted)</option>
                            <option value="systemWhisper">Whisper Script (Local)</option>
                        </SelectField>

                        {tempSettings.sttProvider === 'vosk' && (
                            <InputField
                                label="Vosk Server WebSocket URL"
                                name="voskSttUrl"
                                value={tempSettings.voskSttUrl}
                                onChange={handleChange}
                                placeholder="ws://localhost:2700"
                                description="Enter the WebSocket URL (ws://) of your self-hosted Vosk server."
                                disabled={!tempSettings.voiceEnabled}
                            />
                        )}
                        {tempSettings.sttProvider === 'systemWhisper' && (
                            <div className="text-xs text-base-content/70 bg-base-200 p-3 rounded-md border border-base-300">
                                Records audio in the browser, uploads it to the local proxy, and transcribes locally via
                                <code>scripts/voice/whisper_transcribe.py</code>. Ensure <code>ffmpeg</code> and faster-whisper are installed.
                            </div>
                        )}
                    </CollapsibleSection>

                    <CollapsibleSection title="Advanced Voice Controls">
                        <ToggleSwitch
                            label="Enable Silero VAD"
                            description="Use Voice Activity Detection to automatically stop recording when you finish speaking. (Requires Vosk)"
                            checked={tempSettings.enableSileroVad}
                            onChange={(checked) => handleSettingChange('enableSileroVad', checked)}
                            disabled={!tempSettings.voiceEnabled || tempSettings.sttProvider !== 'vosk'}
                        />
                        <ToggleSwitch
                            label="Enable Porcupine Wake Word"
                            description="Activate voice input by saying a specific wake word. Requires custom integration."
                            checked={tempSettings.enablePorcupineWakeWord}
                            onChange={(checked) => handleSettingChange('enablePorcupineWakeWord', checked)}
                            disabled={!tempSettings.voiceEnabled}
                        />
                        <InputField
                            label="Porcupine Access Key"
                            name="porcupineAccessKey"
                            type="password"
                            value={tempSettings.porcupineAccessKey}
                            onChange={handleChange}
                            description="Enter your Access Key from the PicoVoice Console."
                            disabled={!tempSettings.voiceEnabled || !tempSettings.enablePorcupineWakeWord}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection title="External Piper & Whisper Scripts">
                        <p className="text-sm text-base-content/70">
                            Use these controls to trigger your local Piper TTS and Whisper STT shell scripts via the local proxy whitelist.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-base-content">Piper TTS Daemon</p>
                                        <p className="text-xs text-base-content/60">Runs /home/jeff/piper-toggle-on.sh</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => runVoiceCommand('piper', 'start')}
                                            disabled={!tempSettings.voiceEnabled || piperCommandLoading}
                                        >
                                            {piperCommandLoading && <span className="loading loading-spinner loading-xs mr-1" />}
                                            Start Piper
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-sm"
                                            onClick={() => runVoiceCommand('piper', 'stop')}
                                            disabled={!tempSettings.voiceEnabled || piperCommandLoading}
                                        >
                                            Stop Piper
                                        </button>
                                    </div>
                                </div>
                                {piperCommandStatus && (
                                    <p className={`text-xs mt-2 ${piperCommandStatus.isError ? 'text-error' : 'text-success'}`}>
                                        {piperCommandStatus.message}
                                    </p>
                                )}
                            </div>

                            <div className="divider my-2"></div>

                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-base-content">Whisper STT Daemon</p>
                                        <p className="text-xs text-base-content/60">Runs /home/jeff/whisper-toggle-on.sh</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => runVoiceCommand('whisper', 'start')}
                                            disabled={!tempSettings.voiceEnabled || whisperCommandLoading}
                                        >
                                            {whisperCommandLoading && <span className="loading loading-spinner loading-xs mr-1" />}
                                            Start Whisper
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-sm"
                                            onClick={() => runVoiceCommand('whisper', 'stop')}
                                            disabled={!tempSettings.voiceEnabled || whisperCommandLoading}
                                        >
                                            Stop Whisper
                                        </button>
                                    </div>
                                </div>
                                {whisperCommandStatus && (
                                    <p className={`text-xs mt-2 ${whisperCommandStatus.isError ? 'text-error' : 'text-success'}`}>
                                        {whisperCommandStatus.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>
            )}

            {activeCategory === 'integrations' && (
                <div className="space-y-4">
                    <SectionTitle>Google Workspace</SectionTitle>
                    {!tempSettings.developerMode ? (
                        <>
                            <KeyStatus label="Google Client ID" isSet={googleClientIdIsSet} envVar="GOOGLE_CLIENT_ID" />
                            <KeyStatus label="Google Developer API Key" isSet={googleDevApiKeyIsSet} envVar="GOOGLE_API_DEVELOPER_KEY" />
                        </>
                    ) : (
                        <>
                            <InputField
                                label="Google Client ID (Dev Mode)"
                                description="Enter Client ID directly. Bypasses .env for testing."
                                name="dev_googleClientId"
                                type="password"
                                value={tempSettings.dev_googleClientId}
                                onChange={handleChange}
                            />
                            <InputField
                                label="Google Developer API Key (Dev Mode)"
                                description="Enter API key directly. Bypasses .env for testing."
                                name="dev_googleDeveloperApiKey"
                                type="password"
                                value={tempSettings.dev_googleDeveloperApiKey}
                                onChange={handleChange}
                            />
                        </>
                    )}
                    <div className="p-4 bg-base-200 rounded-lg border border-base-300">
                        {isGoogleSignedIn && googleUser ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {googleUser.picture && <img src={googleUser.picture} alt="User" className="w-10 h-10 rounded-full" />}
                                    <div>
                                        <p className="font-semibold">{googleUser.name}</p>
                                        <p className="text-xs text-base-content/70">{googleUser.email}</p>
                                    </div>
                                </div>
                                <button onClick={handleGoogleSignOut} className="btn btn-outline btn-error">Sign Out</button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">Sign in with Google</p>
                                    <p className="text-xs text-base-content/70">Connect your account to use GDrive, Gmail, and GCal tools.</p>
                                </div>
                                <div className="tooltip" data-tip={(!googleClientIdIsSet || !googleDevApiKeyIsSet) ? 'Google Client ID & Developer API Key must be set in your .env file or in Developer Mode to enable this feature.' : 'Sign in with your Google Account'}>
                                    <button onClick={handleGoogleSignIn} className="btn btn-primary" disabled={!googleClientIdIsSet || !googleDevApiKeyIsSet}>
                                        Sign In
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeCategory === 'social' && (
                <div className="space-y-4">
                    <SectionTitle>Social & Commerce Integrations</SectionTitle>
                    {SOCIAL_PLATFORMS.map(platform => (
                        <PlatformIntegrationRow
                            key={platform.id}
                            platform={platform}
                            creds={tempSettings.socialIntegrations[platform.id]}
                            onChange={handleSocialCredChange}
                            onConnectToggle={handleSocialConnectToggle}
                        />
                    ))}
                </div>
            )}

            {activeCategory === 'debug' && (
                <div className="space-y-4">
                    <SectionTitle>System Prompt</SectionTitle>
                    <textarea 
                        name="systemPrompt" 
                        value={tempSettings.systemPrompt} 
                        onChange={handleChange} 
                        rows={15}
                        className="w-full p-2 rounded-md bg-base-200 border border-base-300 font-mono text-xs"
                    />
                    
                    <SectionTitle>Data Management</SectionTitle>
                    <div className="p-4 bg-base-200 rounded-lg border border-base-300 flex items-center justify-between">
                        <div>
                            <p className="font-semibold">Clear All Local Data</p>
                            <p className="text-xs text-base-content/70">This will permanently delete all chats and the entire knowledge base.</p>
                        </div>
                        <button onClick={handleClearAllData} className="btn btn-error">Clear Data</button>
                    </div>
                    <ToggleSwitch
                        label="Show Full Prompt in Console"
                        description="Log the complete, formatted prompt being sent to the LLM in the browser's developer console."
                        checked={tempSettings.showFullPrompt}
                        onChange={(checked) => handleSettingChange('showFullPrompt', checked)}
                    />
                    <ToggleSwitch
                        label="Log Full Conversations for Training Data"
                        description="Saves a raw transcript of auto-memorized chat segments to a 'LlamaHub_Chat_Logs' folder on your Desktop."
                        checked={tempSettings.logFullConversations}
                        onChange={(checked) => handleSettingChange('logFullConversations', checked)}
                    />
                    <InputField
                        label="Emergency Recovery Passphrase"
                        description="A secret phrase that, when typed as a message, activates recovery mode."
                        name="recoveryPassphrase"
                        type="password"
                        value={tempSettings.recoveryPassphrase}
                        onChange={handleChange}
                    />
                </div>
            )}

            {activeCategory === 'about' && (
                    <div>
                                <SectionTitle>About LlamaHub</SectionTitle>
                                <div className="prose prose-sm max-w-none">
                                    <p>LlamaHub is a locally-run, privacy-first AI assistant built for power users. It gives you a serious control panel for working with local LLMs, tools, and your own data—without handing everything to some remote server.</p>
                                    <p>The core idea behind LlamaHub is decentralization and a local-first mindset: you own the models, you own the data, you own the logs. You’re the admin here, and the system is designed to adapt to your workflow, not the other way around.</p>
                                    <p>LlamaHub is more than “just a chatbot.” It can plug into your tools and environment for things like:</p>
                                    <ul>
                                        <li>persistent knowledge (RAG over your own files),</li>
                                        <li>web access when you choose to enable it,</li>
                                        <li>code generation and analysis,</li>
                                        <li>multi-agent / deep research workflows,</li>
                                        <li>and an expanding set of integrations.</li>
                                    </ul>
                                    <p>I’m actively looking for sponsors and collaborators to help push the platform further. If you’re interested in contributing, integrating it into your own stack, or just want to talk ideas, reach out:</p>
                                    <p>Created and maintained by: Jeff Bulger<br/>Contact: admin@jeffbulger.dev</p>
                                </div>                    </div>
                )}
            </main>
            
            <footer className="p-4 bg-base-200 border-t border-base-300 flex-shrink-0 flex justify-start gap-3">
                <button onClick={closeSettingsModal} className="btn btn-ghost">Cancel</button>
                <button onClick={handleSave} className="btn btn-primary">Save and Close</button>
            </footer>
        </div>
      </div>
    </div>
  );
};
