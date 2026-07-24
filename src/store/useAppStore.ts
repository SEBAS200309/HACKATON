import { create } from 'zustand';
import type {
  AreaOfInterest,
  GeneratedFile,
  OcrResult,
  TemplateMetadata,
  Variable,
  WorkspacePage,
  WorkspaceZone,
} from '@/types';

// ─── Toast type ───────────────────────────────────────────────────────────────
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

// ─── Store State ──────────────────────────────────────────────────────────────
interface AppState {
  // Auth slice
  isAuthenticated: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;

  // Templates slice
  wordTemplates: TemplateMetadata[];
  xlsxTemplates: TemplateMetadata[];
  loadTemplates: () => Promise<void>;

  // Digitization slice
  currentDocument: { url: string; s3Key: string } | null;
  areas: AreaOfInterest[];
  ocrResults: OcrResult[];
  editedValues: Record<string, string>;
  selectedWordTemplate: TemplateMetadata | null;
  selectedXlsxTemplate: TemplateMetadata | null;

  // Workspace slice
  workspaceActive: boolean;
  activeTemplate: TemplateMetadata | null;
  activeXlsxTemplate: TemplateMetadata | null;
  pages: WorkspacePage[];
  currentPageId: string | null;
  availableVariables: Variable[];
  batchProgress: { current: number; total: number } | null;
  generatedFiles: GeneratedFile[];

  // Workspace actions
  initWorkspace: (template: TemplateMetadata, xlsx?: TemplateMetadata | null) => void;
  addPage: (page: Omit<WorkspacePage, 'pageNumber'>) => void;
  removePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  setCurrentPage: (pageId: string) => void;
  addZone: (pageId: string, zone: WorkspaceZone) => void;
  removeZone: (pageId: string, zoneId: string) => void;
  propagateZones: (fromPageId: string, toAll: boolean) => void;
  updateRecord: (pageId: string, variableName: string, value: string) => void;
  setPageOcrResults: (pageId: string, results: OcrResult[]) => void;
  retakePage: (pageId: string, newImageS3Key: string, newImageUrl: string) => void;
  resetWorkspace: () => void;
  persistToLocalStorage: () => void;
  restoreFromLocalStorage: () => boolean;

  // UI slice
  loading: boolean;
  errors: string[];
  toasts: Toast[];
  currentStep: number;

  // Digitization actions
  setCurrentDocument: (doc: { url: string; s3Key: string } | null) => void;
  setAreas: (areas: AreaOfInterest[]) => void;
  addArea: (area: AreaOfInterest) => void;
  updateArea: (id: string, updates: Partial<AreaOfInterest>) => void;
  removeArea: (id: string) => void;
  setOcrResults: (results: OcrResult[]) => void;
  setEditedValue: (variableName: string, value: string) => void;
  setSelectedWordTemplate: (template: TemplateMetadata | null) => void;
  setSelectedXlsxTemplate: (template: TemplateMetadata | null) => void;
  resetDigitization: () => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setCurrentStep: (step: number) => void;
}

// ─── localStorage helpers for area auto-save ──────────────────────────────────
const AREAS_BACKUP_KEY = 'document-digitization-areas-backup';
const WORKSPACE_STORAGE_KEY = 'workspace-session-state';

function saveAreasToLocalStorage(areas: AreaOfInterest[]): void {
  try {
    localStorage.setItem(AREAS_BACKUP_KEY, JSON.stringify(areas));
  } catch {
    // Silently fail — localStorage might be full or unavailable
  }
}

export function loadAreasFromLocalStorage(): AreaOfInterest[] {
  try {
    const stored = localStorage.getItem(AREAS_BACKUP_KEY);
    if (stored) {
      return JSON.parse(stored) as AreaOfInterest[];
    }
  } catch {
    // Silently fail
  }
  return [];
}

export function clearAreasBackup(): void {
  try {
    localStorage.removeItem(AREAS_BACKUP_KEY);
  } catch {
    // Silently fail
  }
}

// ─── Auto-save interval (30 seconds) ─────────────────────────────────────────
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

export function startAreasAutoSave(): void {
  if (autoSaveInterval) return;
  autoSaveInterval = setInterval(() => {
    const { areas } = useAppStore.getState();
    if (areas.length > 0) {
      saveAreasToLocalStorage(areas);
    }
  }, 30_000);
}

export function stopAreasAutoSave(): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

// ─── Workspace helpers ────────────────────────────────────────────────────────

function extractVariablesFromTemplates(
  wordTemplate: TemplateMetadata,
  xlsxTemplate: TemplateMetadata | null | undefined
): Variable[] {
  const variableMap = new Map<string, Variable>();

  // Extract from Word template placeholders
  for (const placeholder of wordTemplate.placeholders) {
    variableMap.set(placeholder, {
      name: placeholder,
      source: 'word',
      assigned: false,
    });
  }

  // Extract from XLSX template placeholders (column headers)
  if (xlsxTemplate) {
    for (const placeholder of xlsxTemplate.placeholders) {
      const existing = variableMap.get(placeholder);
      if (existing) {
        variableMap.set(placeholder, { ...existing, source: 'both' });
      } else {
        variableMap.set(placeholder, {
          name: placeholder,
          source: 'xlsx',
          assigned: false,
        });
      }
    }
  }

  return Array.from(variableMap.values());
}

function renumberPages(pages: WorkspacePage[]): WorkspacePage[] {
  return pages.map((page, index) => ({
    ...page,
    pageNumber: index + 1,
  }));
}

// ─── Store creation ───────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()((set, get) => ({
  // ─── Auth slice ───────────────────────────────────────────────────────────
  isAuthenticated: false,

  login: async (password: string): Promise<boolean> => {
    set({ loading: true });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        set({ isAuthenticated: true, loading: false });
        return true;
      }

      set({
        loading: false,
        errors: [...get().errors, 'Contraseña incorrecta'],
      });
      return false;
    } catch {
      set({
        loading: false,
        errors: [...get().errors, 'Error de conexión. Intente nuevamente'],
      });
      return false;
    }
  },

  logout: () => {
    set({ isAuthenticated: false });
  },

  // ─── Templates slice ──────────────────────────────────────────────────────
  wordTemplates: [],
  xlsxTemplates: [],

  loadTemplates: async (): Promise<void> => {
    set({ loading: true });
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) {
        throw new Error('Error al cargar las plantillas');
      }
      const data = await response.json();
      const templates: TemplateMetadata[] = data.templates ?? [];

      set({
        wordTemplates: templates.filter((t) => t.type === 'word'),
        xlsxTemplates: templates.filter((t) => t.type === 'xlsx'),
        loading: false,
      });
    } catch {
      set({
        loading: false,
        errors: [...get().errors, 'Error al cargar las plantillas. Intente nuevamente'],
      });
    }
  },

  // ─── Digitization slice ───────────────────────────────────────────────────
  currentDocument: null,
  areas: [],
  ocrResults: [],
  editedValues: {},
  selectedWordTemplate: null,
  selectedXlsxTemplate: null,

  setCurrentDocument: (doc) => set({ currentDocument: doc }),

  setAreas: (areas) => set({ areas }),

  addArea: (area) => set((state) => ({ areas: [...state.areas, area] })),

  updateArea: (id, updates) =>
    set((state) => ({
      areas: state.areas.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  removeArea: (id) =>
    set((state) => ({
      areas: state.areas.filter((a) => a.id !== id),
    })),

  setOcrResults: (results) => set({ ocrResults: results }),

  setEditedValue: (variableName, value) =>
    set((state) => ({
      editedValues: { ...state.editedValues, [variableName]: value },
    })),

  setSelectedWordTemplate: (template) => set({ selectedWordTemplate: template }),

  setSelectedXlsxTemplate: (template) => set({ selectedXlsxTemplate: template }),

  resetDigitization: () => {
    clearAreasBackup();
    set({
      currentDocument: null,
      areas: [],
      ocrResults: [],
      editedValues: {},
      selectedWordTemplate: null,
      selectedXlsxTemplate: null,
      currentStep: 0,
    });
  },

  // ─── Workspace slice ─────────────────────────────────────────────────────────
  workspaceActive: false,
  activeTemplate: null,
  activeXlsxTemplate: null,
  pages: [],
  currentPageId: null,
  availableVariables: [],
  batchProgress: null,
  generatedFiles: [],

  initWorkspace: (template, xlsx) => {
    const variables = extractVariablesFromTemplates(template, xlsx);
    set({
      workspaceActive: true,
      activeTemplate: template,
      activeXlsxTemplate: xlsx ?? null,
      availableVariables: variables,
      pages: [],
      currentPageId: null,
      batchProgress: null,
      generatedFiles: [],
    });
  },

  addPage: (page) => {
    const state = get();
    // Auto-apply zones from existing pages if they have zones defined (Req 6.7)
    let zones = page.zones;
    if (state.pages.length > 0) {
      const pagesWithZones = state.pages.filter((p) => p.zones.length > 0);
      if (pagesWithZones.length > 0) {
        zones = pagesWithZones[0].zones.map((z) => ({ ...z }));
      }
    }

    const newPage: WorkspacePage = {
      ...page,
      zones,
      pageNumber: state.pages.length + 1,
    };

    set({
      pages: [...state.pages, newPage],
      currentPageId: state.currentPageId ?? newPage.id,
    });
  },

  removePage: (pageId) => {
    const state = get();
    const filtered = state.pages.filter((p) => p.id !== pageId);
    const renumbered = renumberPages(filtered);

    let newCurrentPageId = state.currentPageId;
    if (state.currentPageId === pageId) {
      newCurrentPageId = renumbered.length > 0 ? renumbered[0].id : null;
    }

    set({
      pages: renumbered,
      currentPageId: newCurrentPageId,
    });
  },

  reorderPages: (fromIndex, toIndex) => {
    const state = get();
    if (
      fromIndex < 0 ||
      fromIndex >= state.pages.length ||
      toIndex < 0 ||
      toIndex >= state.pages.length
    ) {
      return;
    }

    const newPages = [...state.pages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, moved);

    set({ pages: renumberPages(newPages) });
  },

  setCurrentPage: (pageId) => {
    set({ currentPageId: pageId });
  },

  addZone: (pageId, zone) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, zones: [...p.zones, zone] } : p
      ),
    }));
  },

  removeZone: (pageId, zoneId) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? { ...p, zones: p.zones.filter((z) => z.id !== zoneId) }
          : p
      ),
    }));
  },

  propagateZones: (fromPageId, toAll) => {
    if (!toAll) return; // No-op when only applying to current page

    const state = get();
    const sourcePage = state.pages.find((p) => p.id === fromPageId);
    if (!sourcePage) return;

    set({
      pages: state.pages.map((p) =>
        p.id === fromPageId
          ? p
          : { ...p, zones: sourcePage.zones.map((z) => ({ ...z })) }
      ),
    });
  },

  updateRecord: (pageId, variableName, value) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? { ...p, record: { ...p.record, [variableName]: value } }
          : p
      ),
    }));
  },

  setPageOcrResults: (pageId, results) => {
    set((state) => ({
      pages: state.pages.map((p) => {
        if (p.id !== pageId) return p;
        const newRecord = { ...p.record };
        for (const result of results) {
          newRecord[result.variableName] = result.extractedText;
        }
        return {
          ...p,
          record: newRecord,
          ocrProcessed: true,
          status: 'completed' as const,
        };
      }),
    }));
  },

  retakePage: (pageId, newImageS3Key, newImageUrl) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              imageS3Key: newImageS3Key,
              imageUrl: newImageUrl,
              ocrProcessed: false,
              status: 'pending' as const,
              record: {},
            }
          : p
      ),
    }));
  },

  resetWorkspace: () => {
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch {
      // Silently fail
    }
    set({
      workspaceActive: false,
      activeTemplate: null,
      activeXlsxTemplate: null,
      pages: [],
      currentPageId: null,
      availableVariables: [],
      batchProgress: null,
      generatedFiles: [],
    });
  },

  persistToLocalStorage: () => {
    const state = get();
    try {
      const data = {
        workspaceActive: state.workspaceActive,
        activeTemplate: state.activeTemplate,
        activeXlsxTemplate: state.activeXlsxTemplate,
        pages: state.pages,
        currentPageId: state.currentPageId,
        availableVariables: state.availableVariables,
        generatedFiles: state.generatedFiles,
      };
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently fail — localStorage might be full or unavailable
    }
  },

  restoreFromLocalStorage: (): boolean => {
    try {
      const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!stored) return false;

      const data = JSON.parse(stored);
      if (!data || !data.workspaceActive) return false;

      set({
        workspaceActive: data.workspaceActive,
        activeTemplate: data.activeTemplate ?? null,
        activeXlsxTemplate: data.activeXlsxTemplate ?? null,
        pages: data.pages ?? [],
        currentPageId: data.currentPageId ?? null,
        availableVariables: data.availableVariables ?? [],
        generatedFiles: data.generatedFiles ?? [],
        batchProgress: null,
      });
      return true;
    } catch {
      return false;
    }
  },

  // ─── UI slice ─────────────────────────────────────────────────────────────
  loading: false,
  errors: [],
  toasts: [],
  currentStep: 0,

  setLoading: (loading) => set({ loading }),

  addError: (error) => set((state) => ({ errors: [...state.errors, error] })),

  clearErrors: () => set({ errors: [] }),

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setCurrentStep: (step) => set({ currentStep: step }),
}));
