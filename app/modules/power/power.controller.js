// app/modules/power/power.controller.js - WebSocket версия
const powerService = require('./power.service');
const coreLogger = require('../../core/utils/logger');
const CONSTANTS = require('./power.constants');

// Проверяем наличие WebSocket менеджера
let wsManager;
try {
    wsManager = require('./websocket-manager');
} catch (error) {
    console.warn('⚠️ WebSocket менеджер не найден, используем обычный режим');
    wsManager = null;
}

class PowerController {
    constructor() {
        this.config = require('./power.config');
        this.constants = CONSTANTS;
        this.logger = coreLogger.child({ module: this.config.moduleName });
        this.activeCalculations = new Map(); // Для отмены расчетов
    }

    // API для запуска расчета с WebSocket прогрессом
    async calculatePower(req, res) {
        const calculationId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            this.logger.info(`POST /api/power/calculate (WS ID: ${calculationId})`);
            
            // Немедленно возвращаем ответ с ID расчета
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                calculationId,
                wsEndpoint: `/api/power/ws?calculationId=${calculationId}`,
                message: 'Расчет Power запущен с WebSocket прогрессом',
                startedAt: new Date().toISOString()
            });
            
            // Запускаем расчет в фоновом режиме
            this.runCalculationWithProgress(calculationId);
            
        } catch (error) {
            this.logger.error('Ошибка запуска расчета:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
    
    // Запуск расчета с обновлением прогресса через WebSocket
    async runCalculationWithProgress(calculationId) {
        const startTime = Date.now();
        
        try {
            this.logger.info(`[${calculationId}] Запуск расчета с WebSocket прогрессом`);
            
            // Обновляем прогресс через WebSocket если доступен
            if (wsManager) {
                wsManager.updateProgress(calculationId, 0, 'Инициализация расчета...');
            }
            
            // 1. Загружаем данные
            if (wsManager) wsManager.updateProgress(calculationId, 5, 'Загрузка данных атрибутов...');
            const powerData = await powerService.loadAttributesPowerData();
            
            if (wsManager) wsManager.updateProgress(calculationId, 10, 'Загрузка данных о синергиях...');
            const synergyData = await powerService.loadSynergyData();
            
            if (wsManager) wsManager.updateProgress(calculationId, 15, 'Загрузка оригинальных данных NFT...');
            const originalData = await powerService.loadOriginalNFTs();
            
            if (!originalData.nfts || !Array.isArray(originalData.nfts)) {
                throw new Error(CONSTANTS.ERROR_MESSAGES.INVALID_NFT_DATA);
            }
            
            const totalNFTs = originalData.nfts.length;
            if (wsManager) {
                wsManager.updateProgress(
                    calculationId, 
                    20, 
                    `Начинаем обработку ${totalNFTs} NFT...`,
                    { totalNFTs, processed: 0 }
                );
            }
            
            // 2. Создаем структуру для результата
            const powerResult = {
                [CONSTANTS.COLLECTION_KEYS.NFTS]: [],
                [CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]: {
                    ...originalData.collection_info,
                    [CONSTANTS.COLLECTION_KEYS.POWER_CALCULATED]: new Date().toISOString(),
                    [CONSTANTS.COLLECTION_KEYS.SYNERGY_CALCULATED]: new Date().toISOString(),
                    [CONSTANTS.COLLECTION_KEYS.ORIGINAL_FILE]: 'all_nft_info.json',
                    [CONSTANTS.COLLECTION_KEYS.POWER_VERSION]: CONSTANTS.MODULE.VERSION,
                    [CONSTANTS.COLLECTION_KEYS.SYNERGY_TYPES_COUNT]: Object.keys(synergyData).length,
                    processing_mode: 'websocket_progress',
                    calculation_id: calculationId
                }
            };
            
            let processedCount = 0;
            let updatedCount = 0;
            let nftsWithSynergyCount = 0;
            
            // Сохраняем ссылку для возможности отмены
            this.activeCalculations.set(calculationId, {
                id: calculationId,
                startTime,
                abort: false
            });
            
            // 3. Обрабатываем NFT чанками с прогрессом
            const powerUtils = require('./power.utils');
            const chunkSize = CONSTANTS.OPTIMIZATION.CHUNK_SIZE;
            
            for (let i = 0; i < originalData.nfts.length; i += chunkSize) {
                // Проверяем флаг отмены
                if (this.activeCalculations.get(calculationId)?.abort) {
                    this.logger.info(`[${calculationId}] Расчет отменен пользователем`);
                    if (wsManager) {
                        wsManager.updateProgress(calculationId, 0, 'Расчет отменен');
                    }
                    this.activeCalculations.delete(calculationId);
                    return;
                }
                
                const chunk = originalData.nfts.slice(i, i + chunkSize);
                
                // Обрабатываем чанк
                for (const originalNft of chunk) {
                    processedCount++;
                    
                    const nft = JSON.parse(JSON.stringify(originalNft));
                    const result = powerUtils.calculateNFTpower(nft, powerData, synergyData);
                    
                    if (result.updated) updatedCount++;
                    if (result.synergyPower > 0) nftsWithSynergyCount++;
                    
                    powerResult[CONSTANTS.COLLECTION_KEYS.NFTS].push(nft);
                }
                
                // Обновляем прогресс через WebSocket
                if (wsManager) {
                    const progress = 20 + Math.round((processedCount / totalNFTs) * 70);
                    if (processedCount % 1000 === 0 || i + chunkSize >= originalData.nfts.length) {
                        wsManager.updateProgress(
                            calculationId, 
                            progress, 
                            `Обработано ${processedCount}/${totalNFTs} NFT`,
                            { 
                                processed: processedCount,
                                updated: updatedCount,
                                withSynergy: nftsWithSynergyCount,
                                estimatedRemaining: this.estimateRemainingTime(startTime, processedCount, totalNFTs)
                            }
                        );
                    }
                }
                
                // Логируем прогресс в консоль
                if (processedCount % 5000 === 0) {
                    const progress = Math.round((processedCount / totalNFTs) * 100);
                    this.logger.info(`[${calculationId}] Прогресс: ${progress}% (${processedCount}/${totalNFTs})`);
                }
                
                // Даем event loop передохнуть
                if (chunkSize > 500) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            // 4. Сохраняем результат
            if (wsManager) {
                wsManager.updateProgress(calculationId, 95, 'Сохранение результатов...');
            }
            
            await powerService.savePowerNFTs(powerResult);
            
            // 5. Завершаем расчет
            const processingTime = Date.now() - startTime;
            const result = {
                totalProcessed: processedCount,
                totalUpdated: updatedCount,
                nftsWithSynergy: nftsWithSynergyCount,
                processingTimeMs: processingTime,
                fileSaved: 'all_nft_info_power.json',
                calculationId
            };
            
            if (wsManager) {
                wsManager.completeCalculation(calculationId, result);
            }
            
            this.logger.info(`[${calculationId}] Расчет завершен за ${processingTime}ms`);
            this.activeCalculations.delete(calculationId);
            
        } catch (error) {
            this.logger.error(`[${calculationId}] Ошибка расчета:`, error);
            if (wsManager) {
                wsManager.failCalculation(calculationId, error);
            }
            this.activeCalculations.delete(calculationId);
        }
    }
    
    // API для отмены расчета
    async cancelCalculation(req, res) {
        try {
            const { calculationId } = req.params;
            this.logger.info(`POST /api/power/cancel/${calculationId}`);
            
            if (!calculationId) {
                return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'Не указан ID расчета'
                });
            }
            
            const calculation = this.activeCalculations.get(calculationId);
            if (!calculation) {
                return res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    error: 'Расчет не найден или уже завершен'
                });
            }
            
            calculation.abort = true;
            if (wsManager) {
                wsManager.updateProgress(calculationId, 0, 'Расчет отменен пользователем');
            }
            
            res.json({
                success: true,
                message: 'Расчет отменен',
                calculationId
            });
            
        } catch (error) {
            this.logger.error('Ошибка отмены расчета:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // API для проверки статуса расчета
    async getCalculationStatus(req, res) {
        try {
            const { calculationId } = req.params;
            this.logger.info(`GET /api/power/status/${calculationId}`);
            
            if (!calculationId) {
                return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'Не указан ID расчета'
                });
            }
            
            const calculation = this.activeCalculations.get(calculationId);
            
            // Получаем прогресс из WebSocket менеджера если есть
            let wsProgress = null;
            if (wsManager) {
                wsProgress = wsManager.calculationProgress.get(calculationId);
            }
            
            if (!calculation && !wsProgress) {
                return res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    error: 'Расчет не найден'
                });
            }
            
            res.json({
                success: true,
                calculationId,
                isActive: !!calculation,
                progress: wsProgress || null,
                wsEndpoint: `/api/power/ws?calculationId=${calculationId}`
            });
            
        } catch (error) {
            this.logger.error('Ошибка проверки статуса:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // API: Получить данные атрибутов для расчета Power
    async getAttributesData(req, res) {
        try {
            this.logger.info('GET /api/power/attributes-data');
            const data = await powerService.loadAttributesPowerData();
            res.json(data);
        } catch (error) {
            this.logger.error('Ошибка загрузки данных атрибутов:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: 'Не удалось загрузить данные атрибутов' 
            });
        }
    }
    
    // API: Получить все NFT для расчета Power (оригинальные)
    async getNftsData(req, res) {
        try {
            this.logger.info('GET /api/power/nfts-data');
            const data = await powerService.loadOriginalNFTs();
            res.json(data);
        } catch (error) {
            this.logger.error('Ошибка загрузки данных NFT:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: 'Не удалось загрузить данные NFT' 
            });
        }
    }
    
    // API: Получить данные с Power (рассчитанные)
    async getNftsPowerData(req, res) {
        try {
            this.logger.info('GET /api/power/nfts-power-data');
            const data = await powerService.loadPowerNFTs();
            res.json(data);
        } catch (error) {
            this.logger.error('Ошибка загрузки данных с Power:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: 'Не удалось загрузить данные с Power' 
            });
        }
    }
    
    // API: Сохранить обновленные данные с Power
    async saveNfts(req, res) {
        try {
            const { nfts } = req.body;
            this.logger.info('POST /api/power/save-nfts', { nftsCount: nfts?.length || 0 });
            
            if (!nfts || !Array.isArray(nfts)) {
                return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    module: this.config.moduleName,
                    error: CONSTANTS.ERROR_MESSAGES.INVALID_NFT_ARRAY
                });
            }
            
            const result = await powerService.saveUpdatedNFTs(nfts);
            
            res.json({
                success: true,
                module: this.config.moduleName,
                message: `Сохранено: ${result.updated} обновлено, ${result.added} добавлено`,
                stats: result
            });
            
        } catch (error) {
            this.logger.error('❌ Ошибка сохранения данных:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message,
                stack: process.env.NODE_ENV === CONSTANTS.ENVIRONMENT.DEVELOPMENT ? error.stack : undefined
            });
        }
    }
    
    // API: Получить данные о синергиях
    async getSynergyData(req, res) {
        try {
            this.logger.info('GET /api/power/synergy-data');
            const synergyData = await powerService.loadSynergyData();
            res.json(synergyData);
        } catch (error) {
            this.logger.error('Ошибка загрузки данных о синергиях:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: 'Не удалось загрузить данные о синергиях' 
            });
        }
    }
    
    // API: Сравнение файлов
    async compareFiles(req, res) {
        try {
            this.logger.info('GET /api/power/compare-files');
            const comparison = await powerService.compareFiles();
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                comparison 
            });
        } catch (error) {
            this.logger.error('Ошибка сравнения файлов:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
    
    // API: Экспорт только NFT с Power
    async exportPowerOnly(req, res) {
        try {
            this.logger.info('GET /api/power/export-power-only');
            const exportData = await powerService.exportPowerOnly();
            
            // Устанавливаем заголовки для скачивания файла
            res.setHeader(CONSTANTS.HEADERS.CONTENT_DISPOSITION, `attachment; filename="${CONSTANTS.EXPORT_FILES.POWER_ONLY}"`);
            res.setHeader(CONSTANTS.HEADERS.CONTENT_TYPE, CONSTANTS.HEADERS.JSON_TYPE);
            
            res.send(JSON.stringify(exportData, null, 2));
        } catch (error) {
            this.logger.error('Ошибка экспорта:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
    
    // API: Очистить кэш
    async clearCache(req, res) {
        try {
            if (req.query.secret !== process.env[CONSTANTS.ENV_KEYS.CACHE_CLEAR_SECRET]) {
                return res.status(CONSTANTS.HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    module: this.config.moduleName,
                    error: CONSTANTS.ERROR_MESSAGES.CACHE_CLEAR_DENIED
                });
            }

            powerService.clearCache();
            
            res.json({
                success: true,
                module: this.config.moduleName,
                message: CONSTANTS.SUCCESS_MESSAGES.CACHE_CLEARED
            });
        } catch (error) {
            this.logger.error('Ошибка очистки кэша:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                module: this.config.moduleName,
                error: 'Ошибка при очистке кэша'
            });
        }
    }
    
    // API: Получить статус оптимизаций
    async getOptimizationStatus(req, res) {
        try {
            this.logger.info('GET /api/power/optimization-status');
            
            const memoryUsage = process.memoryUsage();
            
            const status = {
                serverInfo: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    uptime: Math.floor(process.uptime()),
                    moduleVersion: CONSTANTS.MODULE.VERSION
                },
                optimizationSettings: {
                    chunkSize: CONSTANTS.OPTIMIZATION.CHUNK_SIZE,
                    maxRetries: CONSTANTS.OPTIMIZATION.MAX_RETRIES,
                    delayBetweenChunks: CONSTANTS.OPTIMIZATION.DELAY_BETWEEN_CHUNKS
                },
                memory: {
                    heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024)
                },
                environment: process.env.NODE_ENV || 'development',
                processingMode: 'websocket_progress',
                websocketAvailable: !!wsManager,
                activeCalculations: this.activeCalculations.size
            };
            
            res.json({
                success: true,
                module: this.config.moduleName,
                status,
                message: 'Режим с WebSocket прогрессом активен'
            });
        } catch (error) {
            this.logger.error('Ошибка получения статуса оптимизаций:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
    
    // API: Тест расчета для одного NFT
    async testSingleNFT(req, res) {
        try {
            const { nftIndex } = req.query;
            this.logger.info(`GET /api/power/test-single?nftIndex=${nftIndex}`);
            
            if (!nftIndex) {
                return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'Не указан индекс NFT'
                });
            }
            
            // Загружаем все необходимые данные
            const powerData = await powerService.loadAttributesPowerData();
            const synergyData = await powerService.loadSynergyData();
            const originalData = await powerService.loadOriginalNFTs();
            
            if (!originalData.nfts || !Array.isArray(originalData.nfts)) {
                throw new Error(CONSTANTS.ERROR_MESSAGES.INVALID_NFT_DATA);
            }
            
            const nft = originalData.nfts.find(n => n.index === parseInt(nftIndex));
            
            if (!nft) {
                return res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    error: `NFT с индексом ${nftIndex} не найден`
                });
            }
            
            // Клонируем NFT для теста
            const testNft = JSON.parse(JSON.stringify(nft));
            
            // Используем утилиты для расчета
            const powerUtils = require('./power.utils');
            const result = powerUtils.calculateNFTpower(testNft, powerData, synergyData);
            
            res.json({
                success: true,
                module: this.config.moduleName,
                nftIndex: parseInt(nftIndex),
                calculation: result,
                powerData: {
                    attributesPower: result.totalPower,
                    synergyPower: result.synergyPower,
                    totalPower: result.totalPower + result.synergyPower
                },
                synergyDetails: result.attributeSynergy
            });
            
        } catch (error) {
            this.logger.error('Ошибка тестового расчета:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
    
    // Вспомогательный метод для оценки оставшегося времени
    estimateRemainingTime(startTime, processed, total) {
        if (processed === 0) return null;
        
        const elapsed = Date.now() - startTime;
        const estimatedTotal = (elapsed / processed) * total;
        const remaining = estimatedTotal - elapsed;
        
        return Math.max(0, Math.round(remaining / 1000)); // В секундах
    }
}

module.exports = new PowerController();