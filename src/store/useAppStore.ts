import { create } from 'zustand';
import type { AreaOfInterest, OcrResult, TemplateMetadata } from '@/types';

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
