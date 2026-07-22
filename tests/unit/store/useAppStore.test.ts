import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore, loadAreasFromLocalStorage, clearAreasBackup, startAreasAutoSave, stopAreasAutoSave } from '@/store/useAppStore';
import type { AreaOfInterest, OcrResult, TemplateMetadata } from '@/types';

// Reset store between tests
beforeEach(() => {
  useAppStore.setState({
    isAuthenticated: false,
    wordTemplates: [],
    xlsxTemplates: [],
    currentDocument: null,
    areas: [],
    ocrResults: [],
    editedValues: {},
    selectedWordTemplate: null,
    selectedXlsxTemplate: null,
    loading: false,
    errors: [],
    toasts: [],
    currentStep: 0,
  });
  localStorage.clear();
});

afterEach(() => {
  stopAreasAutoSave();
  vi.restoreAllMocks();
});

describe('useAppStore - Auth slice', () => {
  it('should start with isAuthenticated false', () => {
    const state = useAppStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set isAuthenticated to true on successful login', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    const result = await useAppStore.getState().login('correcta');

    expect(result).toBe(true);
    expect(useAppStore.getState().isAuthenticated).toBe(true);
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('should add error on failed login', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const result = await useAppStore.getState().login('incorrecta');

    expect(result).toBe(false);
    expect(useAppStore.getState().isAuthenticated).toBe(false);
    expect(useAppStore.getState().errors).toContain('Contraseña incorrecta');
  });

  it('should add error on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await useAppStore.getState().login('test');

    expect(result).toBe(false);
    expect(useAppStore.getState().errors).toContain('Error de conexión. Intente nuevamente');
  });

  it('should set isAuthenticated to false on logout', () => {
    useAppStore.setState({ isAuthenticated: true });
    useAppStore.getState().logout();
    expect(useAppStore.getState().isAuthenticated).toBe(false);
  });
});

describe('useAppStore - Templates slice', () => {
  it('should load and separate word/xlsx templates', async () => {
    const mockTemplates: TemplateMetadata[] = [
      { id: '1', type: 'word', fileName: 'test.docx', s3Key: 'templates/word/1.docx', fileSize: 1000, placeholders: ['nombre'], uploadDate: '2024-01-01' },
      { id: '2', type: 'xlsx', fileName: 'test.xlsx', s3Key: 'templates/xlsx/2.xlsx', fileSize: 2000, placeholders: ['fecha'], uploadDate: '2024-01-02' },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ templates: mockTemplates }),
    });

    await useAppStore.getState().loadTemplates();

    expect(useAppStore.getState().wordTemplates).toHaveLength(1);
    expect(useAppStore.getState().wordTemplates[0].fileName).toBe('test.docx');
    expect(useAppStore.getState().xlsxTemplates).toHaveLength(1);
    expect(useAppStore.getState().xlsxTemplates[0].fileName).toBe('test.xlsx');
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('should add error when template loading fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    await useAppStore.getState().loadTemplates();

    expect(useAppStore.getState().errors).toContain('Error al cargar las plantillas. Intente nuevamente');
  });
});

describe('useAppStore - Digitization slice', () => {
  const mockArea: AreaOfInterest = {
    id: 'area-1',
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.1,
    variableName: 'nombre',
    color: '#ff0000',
  };

  it('should set current document', () => {
    const doc = { url: 'https://example.com/doc.png', s3Key: 'sources/doc.png' };
    useAppStore.getState().setCurrentDocument(doc);
    expect(useAppStore.getState().currentDocument).toEqual(doc);
  });

  it('should add an area', () => {
    useAppStore.getState().addArea(mockArea);
    expect(useAppStore.getState().areas).toHaveLength(1);
    expect(useAppStore.getState().areas[0]).toEqual(mockArea);
  });

  it('should update an area', () => {
    useAppStore.setState({ areas: [mockArea] });
    useAppStore.getState().updateArea('area-1', { variableName: 'apellido' });
    expect(useAppStore.getState().areas[0].variableName).toBe('apellido');
  });

  it('should remove an area', () => {
    useAppStore.setState({ areas: [mockArea] });
    useAppStore.getState().removeArea('area-1');
    expect(useAppStore.getState().areas).toHaveLength(0);
  });

  it('should set OCR results', () => {
    const results: OcrResult[] = [
      { variableName: 'nombre', extractedText: 'Juan', confidence: 95, wordCount: 1 },
    ];
    useAppStore.getState().setOcrResults(results);
    expect(useAppStore.getState().ocrResults).toEqual(results);
  });

  it('should set edited value', () => {
    useAppStore.getState().setEditedValue('nombre', 'Pedro');
    expect(useAppStore.getState().editedValues).toEqual({ nombre: 'Pedro' });
  });

  it('should set areas replacing all', () => {
    const areas: AreaOfInterest[] = [mockArea, { ...mockArea, id: 'area-2', variableName: 'fecha' }];
    useAppStore.getState().setAreas(areas);
    expect(useAppStore.getState().areas).toHaveLength(2);
  });

  it('should reset digitization state and clear backup', () => {
    useAppStore.setState({
      currentDocument: { url: 'x', s3Key: 'y' },
      areas: [mockArea],
      ocrResults: [{ variableName: 'n', extractedText: 'v', confidence: 90, wordCount: 1 }],
      editedValues: { n: 'v2' },
      currentStep: 3,
    });
    localStorage.setItem('document-digitization-areas-backup', JSON.stringify([mockArea]));

    useAppStore.getState().resetDigitization();

    const state = useAppStore.getState();
    expect(state.currentDocument).toBeNull();
    expect(state.areas).toHaveLength(0);
    expect(state.ocrResults).toHaveLength(0);
    expect(state.editedValues).toEqual({});
    expect(state.currentStep).toBe(0);
    expect(localStorage.getItem('document-digitization-areas-backup')).toBeNull();
  });
});

describe('useAppStore - UI slice', () => {
  it('should set loading', () => {
    useAppStore.getState().setLoading(true);
    expect(useAppStore.getState().loading).toBe(true);
  });

  it('should add and clear errors', () => {
    useAppStore.getState().addError('Error de prueba');
    expect(useAppStore.getState().errors).toContain('Error de prueba');
    useAppStore.getState().clearErrors();
    expect(useAppStore.getState().errors).toHaveLength(0);
  });

  it('should add toast with generated id', () => {
    useAppStore.getState().addToast({ type: 'success', message: 'Operación exitosa' });
    const toasts = useAppStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Operación exitosa');
    expect(toasts[0].id).toMatch(/^toast-/);
  });

  it('should remove toast by id', () => {
    useAppStore.getState().addToast({ type: 'error', message: 'Algo falló' });
    const toastId = useAppStore.getState().toasts[0].id;
    useAppStore.getState().removeToast(toastId);
    expect(useAppStore.getState().toasts).toHaveLength(0);
  });

  it('should set current step', () => {
    useAppStore.getState().setCurrentStep(4);
    expect(useAppStore.getState().currentStep).toBe(4);
  });
});

describe('useAppStore - localStorage auto-save', () => {
  const mockArea: AreaOfInterest = {
    id: 'area-1',
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.1,
    variableName: 'nombre',
    color: '#ff0000',
  };

  it('should load areas from localStorage', () => {
    localStorage.setItem('document-digitization-areas-backup', JSON.stringify([mockArea]));
    const areas = loadAreasFromLocalStorage();
    expect(areas).toHaveLength(1);
    expect(areas[0].variableName).toBe('nombre');
  });

  it('should return empty array if no backup exists', () => {
    const areas = loadAreasFromLocalStorage();
    expect(areas).toEqual([]);
  });

  it('should clear areas backup', () => {
    localStorage.setItem('document-digitization-areas-backup', JSON.stringify([mockArea]));
    clearAreasBackup();
    expect(localStorage.getItem('document-digitization-areas-backup')).toBeNull();
  });

  it('should auto-save areas every 30 seconds', () => {
    vi.useFakeTimers();
    useAppStore.setState({ areas: [mockArea] });

    startAreasAutoSave();

    // Advance 30 seconds
    vi.advanceTimersByTime(30_000);

    const stored = localStorage.getItem('document-digitization-areas-backup');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual([mockArea]);

    stopAreasAutoSave();
    vi.useRealTimers();
  });

  it('should not save to localStorage if areas are empty', () => {
    vi.useFakeTimers();
    useAppStore.setState({ areas: [] });

    startAreasAutoSave();
    vi.advanceTimersByTime(30_000);

    expect(localStorage.getItem('document-digitization-areas-backup')).toBeNull();

    stopAreasAutoSave();
    vi.useRealTimers();
  });
});
