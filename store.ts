import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type Message, type Chat, Role, type ResearchJob, type CanvasFile, type CommandResult, type PromptFormat } from './types';
import * as settingsStore from './services/settings';
import * as knowledgeStore from './services/knowledgeStore';
import * as googleAuthService from './services/googleAuthService';
import { createChatSlice, type ChatSlice } from './store/slices/chatSlice';
import { idbGet, idbSet, idbDel } from './services/idb';

const APP_STORAGE_KEY = 'llamahub_store';
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await idbGet(name);
    if (value !== undefined && value !== null) return value;
    if (typeof localStorage !== 'undefined') {
      const legacy = localStorage.getItem(name);
      if (legacy) {
        // migrate legacy to idb
        await idbSet(name, legacy);
      }
      return legacy;
    }
    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await idbDel(name);
  },
};

export type InformationalViews = 'home' | 'features' | 'about' | 'mission' | 'proposals' | 'investors' | 'contact' | 'localLlm' | 'decentralization';
export type AppCoreViews = 'chat' | 'knowledge';
export type ActiveView = InformationalViews | AppCoreViews;

export interface AppState extends ChatSlice {
  // State
  sidebarOpen: boolean;
  isSettingsOpen: boolean;
  settings: settingsStore.Settings;
  activeView: ActiveView;
  isRecoveryModalOpen: boolean;
  isRecoveryModeActive: boolean;
  isAutoSaving: boolean;
  researchJob: ResearchJob | null;
  isGoogleSignedIn: boolean;
  googleUser: googleAuthService.GoogleUserProfile | null;
  isCanvasOpen: boolean;
  canvasFiles: CanvasFile[];
  canvasActiveFileId: string | null;
  mcpJobs: Record<string, string>; // JobId -> ChatId
  mcpStatuses: { name: string; status: string; error?: string }[];
  mcpTools: { name: string; server: string; description?: string; inputSchema?: unknown; outputSchema?: unknown }[];
  isFetchingMcp: boolean;

  // Actions
  // Initialization
  initialize: () => void;
  
  // Settings
  saveSettings: (newSettings: settingsStore.Settings) => void;
  
  // UI Actions
  setSidebarOpen: (isOpen: boolean) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setActiveView: (view: ActiveView) => void;
  openCanvas: () => void;
  closeCanvas: () => void;
  
  // Canvas Actions
  addCanvasFile: (file: CanvasFile) => void;
  deleteCanvasFile: (fileId: string) => void;
  updateCanvasFileContent: (fileId: string, content: string) => void;
  setCanvasActiveFileId: (fileId: string | null) => void;
  clearCanvas: () => void;

  // Recovery Modal
  openRecoveryModal: () => void;
  closeRecoveryModal: () => void;
  confirmRecovery: () => void;
  
  // Google Auth
  setGoogleAuthState: (state: { signedIn: boolean; user: googleAuthService.GoogleUserProfile | null }) => void;
  
  // Research Job
  setResearchJob: (job: ResearchJob | null) => void;

  // MCP
  addMcpJob: (jobId: string, chatId: string) => void;
  removeMcpJob: (jobId: string) => void;
  pollMcpJobs: () => Promise<void>;
  fetchMcpMeta: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createChatSlice(set, get),
      // --- INITIAL STATE ---
      sidebarOpen: true,
      isSettingsOpen: false,
      settings: settingsStore.DEFAULT_SETTINGS,
      activeView: 'chat',
      isRecoveryModalOpen: false,
      isRecoveryModeActive: false,
      isAutoSaving: false,
      researchJob: null,
      isGoogleSignedIn: false,
      googleUser: null,
      isCanvasOpen: false,
      canvasFiles: [],
      canvasActiveFileId: null,
      mcpJobs: {},
      mcpStatuses: [],
      mcpTools: [],
      isFetchingMcp: false,

      // --- ACTIONS ---
      initialize: () => {
        const { chats, currentChatId, settings, saveSettings, researchJob, setResearchJob } = get();

        if (researchJob?.status === 'running') {
            setResearchJob({ ...researchJob, status: 'interrupted' });
        }

        const mergedSettings = {
          ...settingsStore.DEFAULT_SETTINGS,
          ...settings,
          multiAgentSettings: {
            ...settingsStore.DEFAULT_SETTINGS.multiAgentSettings,
            ...(settings.multiAgentSettings || {}),
            agents: {
              ...settingsStore.DEFAULT_SETTINGS.multiAgentSettings.agents,
              ...((settings.multiAgentSettings && settings.multiAgentSettings.agents) || {}),
            },
          },
          socialIntegrations: {
            ...settingsStore.DEFAULT_SETTINGS.socialIntegrations,
            ...(settings.socialIntegrations || {}),
          }
        };

        // Ensure MCP servers include defaults (e.g., Playwright MCP) if missing
        const existingMcp = Array.isArray(mergedSettings.mcpServers) ? mergedSettings.mcpServers : [];
        const hasPlaywright = existingMcp.some(s => s.url === 'http://localhost:3005/sse');
        const mergedMcp = existingMcp.length > 0 ? existingMcp : settingsStore.DEFAULT_SETTINGS.mcpServers;
        mergedSettings.mcpServers = hasPlaywright
          ? mergedMcp
          : [...mergedMcp, ...settingsStore.DEFAULT_SETTINGS.mcpServers.filter(s => s.url === 'http://localhost:3005/sse')];
      
        if (JSON.stringify(settings) !== JSON.stringify(mergedSettings)) {
            saveSettings(mergedSettings);
        }

        if (chats.length > 0) {
          const firstUnarchived = chats.find((c: Chat) => !c.isArchived);
          if (firstUnarchived && !currentChatId) {
            set({ currentChatId: firstUnarchived.id });
          }
        } else {
            get().newChat();
        }

        // Kick off MCP discovery in the background
        get().fetchMcpMeta().catch(error => {
          console.error('[MCP] Failed to refresh MCP metadata on init:', error);
        });
      },
      
      saveSettings: (newSettings) => {
        set({ settings: newSettings });
      },

      setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
      openSettingsModal: () => set({ isSettingsOpen: true }),
      closeSettingsModal: () => set({ isSettingsOpen: false }),
      setActiveView: (view) => {
        const isAppView = ['chat', 'knowledge'].includes(view);
        if (isAppView && !get().currentChatId && get().chats.length > 0) {
          const firstUnarchived = get().chats.find(c => !c.isArchived);
          set({ currentChatId: firstUnarchived?.id || null });
        }
        set({ activeView: view });
      },
      openCanvas: () => set({ isCanvasOpen: true }),
      closeCanvas: () => set({ isCanvasOpen: false }),

      addCanvasFile: (file) => set(state => ({ canvasFiles: [...state.canvasFiles, file] })),
      deleteCanvasFile: (fileId) => set(state => {
          const newFiles = state.canvasFiles.filter(f => f.id !== fileId);
          let newActiveId = state.canvasActiveFileId;
          if (newActiveId === fileId) {
              newActiveId = newFiles.length > 0 ? newFiles[0].id : null;
          }
          return { canvasFiles: newFiles, canvasActiveFileId: newActiveId };
      }),
      updateCanvasFileContent: (fileId, content) => set(state => ({
          canvasFiles: state.canvasFiles.map(f => f.id === fileId ? { ...f, content } : f)
      })),
      setCanvasActiveFileId: (fileId) => set({ canvasActiveFileId: fileId }),
      clearCanvas: () => set({ canvasFiles: [], canvasActiveFileId: null }),

      openRecoveryModal: () => set({ isRecoveryModalOpen: true }),
      closeRecoveryModal: () => set({ isRecoveryModalOpen: false, isRecoveryModeActive: false }),
      confirmRecovery: () => set({ isRecoveryModalOpen: false, isRecoveryModeActive: true }),
      
      setGoogleAuthState: (state) => set({ isGoogleSignedIn: state.signedIn, googleUser: state.user }),

      setResearchJob: (job) => set({ researchJob: job }),

      addMcpJob: (jobId, chatId) => set(state => ({ mcpJobs: { ...state.mcpJobs, [jobId]: chatId }})),
      removeMcpJob: (jobId) => set(state => {
          const newJobs = { ...state.mcpJobs };
          delete newJobs[jobId];
          return { mcpJobs: newJobs };
      }),
      pollMcpJobs: async () => {
        // Not implemented in this version
      },
      fetchMcpMeta: async () => {
        try {
          set({ isFetchingMcp: true });
          const [statusRes, toolsRes] = await Promise.all([
            import('./services/mcpHubService').then(m => m.fetchMcpStatus()),
            import('./services/mcpHubService').then(m => m.fetchMcpTools())
          ]);
          set({
            mcpStatuses: statusRes.servers || [],
            mcpTools: toolsRes.tools || [],
            isFetchingMcp: false,
          });
        } catch (error) {
          console.error('[MCP] Failed to fetch status/tools:', error);
          set({ mcpStatuses: [], mcpTools: [], isFetchingMcp: false });
        }
      },
    }),
    {
      name: APP_STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        chats: state.chats,
        currentChatId: state.currentChatId,
        settings: state.settings,
        sidebarOpen: state.sidebarOpen,
        canvasFiles: state.canvasFiles,
        canvasActiveFileId: state.canvasActiveFileId,
        mcpJobs: state.mcpJobs,
      }),
    }
  )
);
