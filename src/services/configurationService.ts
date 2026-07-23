import { storageService } from './storageService';
import type { SegmentationConfig, SegmentationConfigMeta } from '@/types';

/**
 * ConfigurationService — Gestión de configuraciones de segmentación.
 *
 * Almacena las configuraciones en S3 bajo la estructura:
 *   configs/{templateId}/{configName}.json — Configuración completa
 *   configs/index.json — Índice de todas las configuraciones
 *
 * Las coordenadas se almacenan como porcentajes (0–1) relativos
 * a las dimensiones del documento (x, y, width, height).
 */

export interface ConfigurationService {
  saveConfiguration(config: SegmentationConfig): Promise<void>;
  loadConfiguration(templateId: string, configName: string): Promise<SegmentationConfig>;
  listConfigurations(templateId?: string): Promise<SegmentationConfigMeta[]>;
  deleteConfiguration(templateId: string, configName: string): Promise<void>;
}

class ConfigurationServiceImpl implements ConfigurationService {
  /**
   * Guarda una configuración de segmentación en S3 y actualiza el índice.
   * Si ya existe una configuración con el mismo templateId y configName, se sobrescribe.
   */
  async saveConfiguration(config: SegmentationConfig): Promise<void> {
    const s3Key = `configs/${config.templateId}/${config.configName}.json`;
    const configWithTimestamp: SegmentationConfig = {
      ...config,
      lastModified: new Date().toISOString(),
    };
    const body = Buffer.from(JSON.stringify(configWithTimestamp, null, 2), 'utf-8');
    await storageService.putObject(s3Key, body, 'application/json');

    // Actualizar configs/index.json
    const currentIndex = (await storageService.getJsonIndex('configs')) as SegmentationConfigMeta[];

    // Eliminar entrada existente para este templateId + configName si existe
    const filteredIndex = currentIndex.filter(
      (c) => !(c.templateId === config.templateId && c.configName === config.configName)
    );

    // Agregar nueva entrada de metadatos
    const meta: SegmentationConfigMeta = {
      templateId: config.templateId,
      configName: config.configName,
      areaCount: config.areas.length,
      lastModified: configWithTimestamp.lastModified,
    };
    filteredIndex.push(meta);

    await storageService.updateJsonIndex('configs', filteredIndex);
  }

  /**
   * Carga una configuración de segmentación desde S3.
   * Lanza error si la configuración no existe.
   */
  async loadConfiguration(templateId: string, configName: string): Promise<SegmentationConfig> {
    const s3Key = `configs/${templateId}/${configName}.json`;
    const buffer = await storageService.getObject(s3Key);
    const config = JSON.parse(buffer.toString('utf-8')) as SegmentationConfig;
    return config;
  }

  /**
   * Lista las configuraciones disponibles. Si se proporciona templateId,
   * filtra solo las configuraciones asociadas a esa plantilla.
   */
  async listConfigurations(templateId?: string): Promise<SegmentationConfigMeta[]> {
    const currentIndex = (await storageService.getJsonIndex('configs')) as SegmentationConfigMeta[];
    if (templateId) {
      return currentIndex.filter((c) => c.templateId === templateId);
    }
    return currentIndex;
  }

  /**
   * Elimina una configuración de segmentación de S3 y actualiza el índice.
   */
  async deleteConfiguration(templateId: string, configName: string): Promise<void> {
    const s3Key = `configs/${templateId}/${configName}.json`;
    await storageService.deleteObject(s3Key);

    // Actualizar índice removiendo la entrada eliminada
    const currentIndex = (await storageService.getJsonIndex('configs')) as SegmentationConfigMeta[];
    const updatedIndex = currentIndex.filter(
      (c) => !(c.templateId === templateId && c.configName === configName)
    );
    await storageService.updateJsonIndex('configs', updatedIndex);
  }
}

// Singleton para uso en toda la aplicación
export const configurationService: ConfigurationService = new ConfigurationServiceImpl();
