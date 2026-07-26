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
  initWorkspace: (template: TemplateMetadata | null, xlsx?: TemplateMetadata | null) => void;
  addPage: (page: Omit<WorkspacePage, 'pageNumber'>) => void;
  removePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  setCurrentPage: (pageId: string) => void;
  togglePageOrientation: (pageId: string) => void;
  addZone: (pageId: string, zone: WorkspaceZone) => void;
  removeZone: (pageId: string, zoneId: string) => void;
  propagateZones: (fromPageId: string, toAll: boolean) => void;
  updateVariableSettings: (variableName: string, settings: { required?: boolean; broadcastToAll?: boolean }) => void;
  updateRecord: (pageId: string, variableName: string, value: string) => void;
  setPageOcrResults: (pageId: string, results: OcrResult[]) => void;
  retakePage: (pageId: string, newImageS3Key: string, newImageUrl: string) => void;
  resetWorkspace: () => void;
  persistToLocalStorage: () => boolean;
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
  primaryTemplate: TemplateMetadata | null,
  secondaryTemplate: TemplateMetadata | null | undefined
): Variable[] {
  const variableMap = new Map<string, Variable>();

  // Extract from primary template placeholders
  if (primaryTemplate) {
    const primarySource: 'word' | 'xlsx' = primaryTemplate.type === 'xlsx' ? 'xlsx' : 'word';
    for (const placeholder of primaryTemplate.placeholders) {
      variableMap.set(placeholder, {
        name: placeholder,
        source: primarySource,
        assigned: false,
        required: true,
        broadcastToAll: false,
      });
    }
  }

  // Extract from secondary template placeholders
  if (secondaryTemplate) {
    const secondarySource: 'word' | 'xlsx' = secondaryTemplate.type === 'xlsx' ? 'xlsx' : 'word';
    for (const placeholder of secondaryTemplate.placeholders) {
      const existing = variableMap.get(placeholder);
      if (existing) {
        variableMap.set(placeholder, { ...existing, source: 'both' });
      } else {
        variableMap.set(placeholder, {
          name: placeholder,
          source: secondarySource,
          assigned: false,
          required: true,
          broadcastToAll: false,
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
    // Clear workspace state from localStorage
    try {
      localStorage.removeItem('workspace-session-state');
    } catch {
      // Silently fail
    }
    set({
      isAuthenticated: false,
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
      activeTemplate: template ?? null,
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

  togglePageOrientation: (pageId) => {
    set((state) => {
      const newPages = state.pages.map((p) => {
        if (p.id !== pageId) return p;
        const newOrientation: 'portrait' | 'landscape' = p.orientation === 'landscape' ? 'portrait' : 'landscape';
        // Reubicar zonas: intercambiar ejes x↔y y width↔height
        const remappedZones = p.zones.map((z) => ({
          ...z,
          x: z.y,
          y: z.x,
          width: z.height,
          height: z.width,
        }));
        return { ...p, orientation: newOrientation, zones: remappedZones };
      });
      return { pages: newPages };
    });
  },

  addZone: (pageId, zone) => {
    set((state) => {
      const newPages = state.pages.map((p) =>
        p.id === pageId ? { ...p, zones: [...p.zones, zone] } : p
      );
      // Recalcular assigned en availableVariables basándose en las zonas actuales
      const allZoneVarNames = new Set(newPages.flatMap((p) => p.zones.map((z) => z.variableName)));
      const updatedVariables = state.availableVariables.map((v) => ({
        ...v,
        assigned: allZoneVarNames.has(v.name),
      }));
      return { pages: newPages, availableVariables: updatedVariables };
    });
  },

  removeZone: (pageId, zoneId) => {
    set((state) => {
      const newPages = state.pages.map((p) =>
        p.id === pageId
          ? { ...p, zones: p.zones.filter((z) => z.id !== zoneId) }
          : p
      );
      // Recalcular assigned
      const allZoneVarNames = new Set(newPages.flatMap((p) => p.zones.map((z) => z.variableName)));
      const updatedVariables = state.availableVariables.map((v) => ({
        ...v,
        assigned: allZoneVarNames.has(v.name),
      }));
      return { pages: newPages, availableVariables: updatedVariables };
    });
  },

  propagateZones: (fromPageId, toAll) => {
    if (!toAll) return; // No-op when only applying to current page

    const state = get();
    const sourcePage = state.pages.find((p) => p.id === fromPageId);
    if (!sourcePage) return;

    const newPages = state.pages.map((p) =>
      p.id === fromPageId
        ? p
        : { ...p, zones: sourcePage.zones.map((z) => ({ ...z })) }
    );

    // Recalcular assigned
    const allZoneVarNames = new Set(newPages.flatMap((p) => p.zones.map((z) => z.variableName)));
    const updatedVariables = state.availableVariables.map((v) => ({
      ...v,
      assigned: allZoneVarNames.has(v.name),
    }));

    set({ pages: newPages, availableVariables: updatedVariables });
  },

  updateVariableSettings: (variableName, settings) => {
    set((state) => {
      const updatedVariables = state.availableVariables.map((v) =>
        v.name === variableName ? { ...v, ...settings } : v
      );

      // Resetear OCR de todas las páginas para que se vuelva a procesar
      const resetPages = state.pages.map((p) =>
        p.ocrProcessed
          ? { ...p, ocrProcessed: false, status: 'pending' as const, record: {}, records: undefined }
          : p
      );

      return { availableVariables: updatedVariables, pages: resetPages };
    });
  },

  updateRecord: (pageId, variableName, value) => {
    set((state) => ({
      pages: state.pages.map((p) => {
        if (p.id !== pageId) return p;

        // Manejar actualización de multi-record (formato: __multi__${index}__${varName})
        if (variableName.startsWith('__multi__')) {
          const parts = variableName.split('__');
          const recIdx = parseInt(parts[2], 10);
          const actualVarName = parts[3];
          if (!p.records || isNaN(recIdx)) return p;

          const newRecords = [...p.records];
          if (newRecords[recIdx]) {
            newRecords[recIdx] = { ...newRecords[recIdx], [actualVarName]: value };
          }
          return { ...p, records: newRecords };
        }

        // Modo estándar
        return { ...p, record: { ...p.record, [variableName]: value } };
      }),
    }));
  },

  setPageOcrResults: (pageId, results) => {
    const state = get();
    const isXlsxMode = state.activeXlsxTemplate !== null && state.activeTemplate === null;

    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.id !== pageId) return p;

        // Modo estándar (Word o Word+XLSX): un registro por página
        const newRecord = { ...p.record };
        for (const result of results) {
          newRecord[result.variableName] = result.extractedText;
        }

        // Modo XLSX-only con columnas: detectar múltiples líneas y crear registros
        let multiRecords: Record<string, string>[] | undefined;
        if (isXlsxMode) {
          // Identificar variables broadcast (se copian a todos los registros)
          const broadcastVars = s.availableVariables
            .filter((v) => v.broadcastToAll)
            .map((v) => v.name);

          // Separar cada resultado por líneas (newline)
          const splitResults: Record<string, string[]> = {};
          const broadcastValues: Record<string, string> = {};
          let maxLines = 0;

          for (const result of results) {
            if (broadcastVars.includes(result.variableName)) {
              // Variables broadcast: usar el texto completo (sin split)
              broadcastValues[result.variableName] = result.extractedText;
            } else {
              const lines = result.extractedText
                .split(/\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
              splitResults[result.variableName] = lines;
              if (lines.length > maxLines) maxLines = lines.length;
            }
          }

          // Si alguna variable tiene más de 1 línea, crear múltiples registros
          if (maxLines > 1) {
            multiRecords = [];
            for (let i = 0; i < maxLines; i++) {
              const row: Record<string, string> = {};
              // Agregar valores split (una línea por registro)
              for (const varName of Object.keys(splitResults)) {
                row[varName] = splitResults[varName][i] ?? '';
              }
              // Agregar valores broadcast (mismo valor en todos los registros)
              for (const [varName, value] of Object.entries(broadcastValues)) {
                row[varName] = value;
              }
              multiRecords.push(row);
            }
          }
        }

        return {
          ...p,
          record: newRecord,
          records: multiRecords,
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

  persistToLocalStorage: (): boolean => {
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
      return true;
    } catch {
      return false;
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
        pages: (data.pages ?? []).map((p: WorkspacePage) => ({
          ...p,
          orientation: p.orientation ?? 'portrait',
        })),
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
