import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SegmentationConfig, SegmentationConfigMeta } from '@/types';

// Mock storageService
const mockPutObject = vi.fn();
const mockGetObject = vi.fn();
const mockDeleteObject = vi.fn();
const mockGetJsonIndex = vi.fn();
const mockUpdateJsonIndex = vi.fn();

vi.mock('@/services/storageService', () => ({
  storageService: {
    putObject: (...args: any[]) => mockPutObject(...args),
    getObject: (...args: any[]) => mockGetObject(...args),
    deleteObject: (...args: any[]) => mockDeleteObject(...args),
    getJsonIndex: (...args: any[]) => mockGetJsonIndex(...args),
    updateJsonIndex: (...args: any[]) => mockUpdateJsonIndex(...args),
  },
}));

describe('ConfigurationService', () => {
  let configurationService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetJsonIndex.mockResolvedValue([]);
    mockUpdateJsonIndex.mockResolvedValue(undefined);
    mockPutObject.mockResolvedValue(undefined);
    mockDeleteObject.mockResolvedValue(undefined);

    // Re-import para obtener instancia fresca
    vi.resetModules();
    vi.doMock('@/services/storageService', () => ({
      storageService: {
        putObject: (...args: any[]) => mockPutObject(...args),
        getObject: (...args: any[]) => mockGetObject(...args),
        deleteObject: (...args: any[]) => mockDeleteObject(...args),
        getJsonIndex: (...args: any[]) => mockGetJsonIndex(...args),
        updateJsonIndex: (...args: any[]) => mockUpdateJsonIndex(...args),
      },
    }));

    const module = await import('@/services/configurationService');
    configurationService = module.configurationService;
  });

  const crearConfiguracion = (overrides?: Partial<SegmentationConfig>): SegmentationConfig => ({
    templateId: 'template-001',
    configName: 'config-principal',
    areas: [
      {
        id: 'area-1',
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.15,
        variableName: 'nombre_completo',
        color: '#ff0000',
      },
      {
        id: 'area-2',
        x: 0.5,
        y: 0.6,
        width: 0.25,
        height: 0.1,
        variableName: 'fecha_nacimiento',
        color: '#00ff00',
      },
    ],
    lastModified: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  describe('saveConfiguration', () => {
    it('debe almacenar la configuración como JSON en S3 con la ruta correcta', async () => {
      const config = crearConfiguracion();

      await configurationService.saveConfiguration(config);

      expect(mockPutObject).toHaveBeenCalledWith(
        'configs/template-001/config-principal.json',
        expect.any(Buffer),
        'application/json'
      );

      // Verificar que el JSON almacenado contiene los datos correctos
      const storedBuffer = mockPutObject.mock.calls[0][1] as Buffer;
      const storedConfig = JSON.parse(storedBuffer.toString('utf-8'));
      expect(storedConfig.templateId).toBe('template-001');
      expect(storedConfig.configName).toBe('config-principal');
      expect(storedConfig.areas).toHaveLength(2);
      expect(storedConfig.lastModified).toBeDefined();
    });

    it('debe almacenar coordenadas como porcentajes (0–1) en cada área', async () => {
      const config = crearConfiguracion();

      await configurationService.saveConfiguration(config);

      const storedBuffer = mockPutObject.mock.calls[0][1] as Buffer;
      const storedConfig = JSON.parse(storedBuffer.toString('utf-8'));
      const area = storedConfig.areas[0];

      expect(area.x).toBe(0.1);
      expect(area.y).toBe(0.2);
      expect(area.width).toBe(0.3);
      expect(area.height).toBe(0.15);
      expect(area.variableName).toBe('nombre_completo');
    });

    it('debe actualizar el índice configs/index.json con la nueva entrada', async () => {
      const config = crearConfiguracion();

      await configurationService.saveConfiguration(config);

      expect(mockGetJsonIndex).toHaveBeenCalledWith('configs');
      expect(mockUpdateJsonIndex).toHaveBeenCalledWith('configs', [
        {
          templateId: 'template-001',
          configName: 'config-principal',
          areaCount: 2,
          lastModified: expect.any(String),
        },
      ]);
    });

    it('debe sobrescribir la entrada existente en el índice si ya existe', async () => {
      const existingIndex: SegmentationConfigMeta[] = [
        {
          templateId: 'template-001',
          configName: 'config-principal',
          areaCount: 1,
          lastModified: '2024-01-01T00:00:00.000Z',
        },
        {
          templateId: 'template-002',
          configName: 'otra-config',
          areaCount: 3,
          lastModified: '2024-01-02T00:00:00.000Z',
        },
      ];
      mockGetJsonIndex.mockResolvedValue(existingIndex);

      const config = crearConfiguracion();
      await configurationService.saveConfiguration(config);

      const updatedIndex = mockUpdateJsonIndex.mock.calls[0][1] as SegmentationConfigMeta[];
      expect(updatedIndex).toHaveLength(2);

      // La entrada de template-002 debe permanecer intacta
      const otraConfig = updatedIndex.find((c) => c.templateId === 'template-002');
      expect(otraConfig).toBeDefined();
      expect(otraConfig!.configName).toBe('otra-config');

      // La entrada actualizada debe tener el nuevo areaCount
      const configActualizada = updatedIndex.find(
        (c) => c.templateId === 'template-001' && c.configName === 'config-principal'
      );
      expect(configActualizada).toBeDefined();
      expect(configActualizada!.areaCount).toBe(2);
    });

    it('debe asignar lastModified con la fecha actual al guardar', async () => {
      const config = crearConfiguracion();
      const antesDeGuardar = new Date().toISOString();

      await configurationService.saveConfiguration(config);

      const storedBuffer = mockPutObject.mock.calls[0][1] as Buffer;
      const storedConfig = JSON.parse(storedBuffer.toString('utf-8'));
      const despuesDeGuardar = new Date().toISOString();

      expect(storedConfig.lastModified >= antesDeGuardar).toBe(true);
      expect(storedConfig.lastModified <= despuesDeGuardar).toBe(true);
    });
  });

  describe('loadConfiguration', () => {
    it('debe recuperar y parsear la configuración JSON desde S3', async () => {
      const configData: SegmentationConfig = crearConfiguracion();
      const buffer = Buffer.from(JSON.stringify(configData), 'utf-8');
      mockGetObject.mockResolvedValue(buffer);

      const resultado = await configurationService.loadConfiguration(
        'template-001',
        'config-principal'
      );

      expect(mockGetObject).toHaveBeenCalledWith('configs/template-001/config-principal.json');
      expect(resultado.templateId).toBe('template-001');
      expect(resultado.configName).toBe('config-principal');
      expect(resultado.areas).toHaveLength(2);
      expect(resultado.areas[0].variableName).toBe('nombre_completo');
    });

    it('debe lanzar error cuando la configuración no existe en S3', async () => {
      mockGetObject.mockRejectedValue(
        new Error('El archivo no existe en S3 (key: configs/template-001/inexistente.json)')
      );

      await expect(
        configurationService.loadConfiguration('template-001', 'inexistente')
      ).rejects.toThrow('El archivo no existe en S3');
    });
  });

  describe('listConfigurations', () => {
    const mockConfigs: SegmentationConfigMeta[] = [
      {
        templateId: 'template-001',
        configName: 'config-a',
        areaCount: 2,
        lastModified: '2024-01-01T00:00:00.000Z',
      },
      {
        templateId: 'template-002',
        configName: 'config-b',
        areaCount: 5,
        lastModified: '2024-01-02T00:00:00.000Z',
      },
      {
        templateId: 'template-001',
        configName: 'config-c',
        areaCount: 3,
        lastModified: '2024-01-03T00:00:00.000Z',
      },
    ];

    it('debe retornar todas las configuraciones si no se especifica templateId', async () => {
      mockGetJsonIndex.mockResolvedValue(mockConfigs);

      const resultado = await configurationService.listConfigurations();

      expect(resultado).toEqual(mockConfigs);
      expect(resultado).toHaveLength(3);
    });

    it('debe filtrar configuraciones por templateId cuando se proporciona', async () => {
      mockGetJsonIndex.mockResolvedValue(mockConfigs);

      const resultado = await configurationService.listConfigurations('template-001');

      expect(resultado).toHaveLength(2);
      expect(resultado.every((c: SegmentationConfigMeta) => c.templateId === 'template-001')).toBe(
        true
      );
    });

    it('debe retornar array vacío si no hay configuraciones', async () => {
      mockGetJsonIndex.mockResolvedValue([]);

      const resultado = await configurationService.listConfigurations();

      expect(resultado).toEqual([]);
    });

    it('debe retornar array vacío si templateId no tiene configuraciones', async () => {
      mockGetJsonIndex.mockResolvedValue(mockConfigs);

      const resultado = await configurationService.listConfigurations('template-inexistente');

      expect(resultado).toEqual([]);
    });
  });

  describe('deleteConfiguration', () => {
    it('debe eliminar el archivo de S3 con la ruta correcta', async () => {
      mockGetJsonIndex.mockResolvedValue([
        {
          templateId: 'template-001',
          configName: 'config-a',
          areaCount: 2,
          lastModified: '2024-01-01T00:00:00.000Z',
        },
      ]);

      await configurationService.deleteConfiguration('template-001', 'config-a');

      expect(mockDeleteObject).toHaveBeenCalledWith('configs/template-001/config-a.json');
    });

    it('debe actualizar el índice removiendo la configuración eliminada', async () => {
      const existingIndex: SegmentationConfigMeta[] = [
        {
          templateId: 'template-001',
          configName: 'config-a',
          areaCount: 2,
          lastModified: '2024-01-01T00:00:00.000Z',
        },
        {
          templateId: 'template-002',
          configName: 'config-b',
          areaCount: 5,
          lastModified: '2024-01-02T00:00:00.000Z',
        },
      ];
      mockGetJsonIndex.mockResolvedValue(existingIndex);

      await configurationService.deleteConfiguration('template-001', 'config-a');

      expect(mockUpdateJsonIndex).toHaveBeenCalledWith('configs', [
        {
          templateId: 'template-002',
          configName: 'config-b',
          areaCount: 5,
          lastModified: '2024-01-02T00:00:00.000Z',
        },
      ]);
    });

    it('debe mantener otras configuraciones intactas al eliminar una', async () => {
      const existingIndex: SegmentationConfigMeta[] = [
        {
          templateId: 'template-001',
          configName: 'config-a',
          areaCount: 2,
          lastModified: '2024-01-01T00:00:00.000Z',
        },
        {
          templateId: 'template-001',
          configName: 'config-b',
          areaCount: 3,
          lastModified: '2024-01-02T00:00:00.000Z',
        },
      ];
      mockGetJsonIndex.mockResolvedValue(existingIndex);

      await configurationService.deleteConfiguration('template-001', 'config-a');

      const updatedIndex = mockUpdateJsonIndex.mock.calls[0][1] as SegmentationConfigMeta[];
      expect(updatedIndex).toHaveLength(1);
      expect(updatedIndex[0].configName).toBe('config-b');
    });
  });
});
