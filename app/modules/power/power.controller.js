// app/modules/power/power.controller.js - версия без WebSocket
const powerService = require('./power.service');
const coreLogger = require('../../core/utils/logger');
const CONSTANTS = require('./power.constants');

class PowerController {
    constructor() {
        this.config = require('./power.config');
        this.constants = CONSTANTS;
        this.logger = coreLogger.child({ module: this.config.moduleName });
        this.activeCalculations = new Map(); // Для хранения состояния расчетов
    }

    // API для запуска расчета
    async calculatePower(req, res) {
        const calculationId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            this.logger.info(`POST /api/power/calculate (ID: ${calculationId})`);
            
            // Сразу запускаем расчет в фоне
            const startData = {
                id: calculationId,
                startTime: Date.now(),
                status: 'running',
                progress: 0,
                message: 'Инициализация расчета...',
                details: {},
                result: null,
                error: null
            };
            
            this.activeCalculations.set(calculationId, startData);
            
            // Запускаем расчет в фоновом режиме
            this.runCalculation(calculationId);
            
            // Возвращаем ID расчета
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                calculationId,
                message: 'Расчет Power запущен',
                startedAt: new Date().toISOString(),
                statusEndpoint: `/api/power/status/${calculationId}`
            });
            
        } catch (error) {
            this.logger.error('Ошибка запуска расчета:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
    
    // Запуск расчета с обновлением прогресса
    async runCalculation(calculationId) {
        const startTime = Date.now();
        
        try {
            this.logger.info(`[${calculationId}] Запуск расчета Power`);
            
            // Обновляем статус
            this.updateCalculationStatus(calculationId, 0, 'Инициализация расчета...');
            
            // 1. Загружаем данные
            this.updateCalculationStatus(calculationId, 5, 'Загрузка данных атрибутов...');
            const powerData = await powerService.loadAttributesPowerData();
            
            this.updateCalculationStatus(calculationId, 10, 'Загрузка данных о синергиях...');
            const synergyData = await powerService.loadSynergyData();
            
            this.updateCalculationStatus(calculationId, 15, 'Загрузка оригинальных данных NFT...');
            const originalData = await powerService.loadOriginalNFTs();
            
            if (!originalData.nfts || !Array.isArray(originalData.nfts)) {
                throw new Error(CONSTANTS.ERROR_MESSAGES.INVALID_NFT_DATA);
            }
            
            const totalNFTs = originalData.nfts.length;
            this.updateCalculationStatus(calculationId, 20, 
                `Начинаем обработку ${totalNFTs} NFT...`,
                { totalNFTs, processed: 0 }
            );
            
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
                    processing_mode: 'server_optimized',
                    calculation_id: calculationId
                }
            };
            
            let processedCount = 0;
            let nftsWithSynergyCount = 0;
            let totalPowerNumber = 0; // ← ДОБАВЛЕНО: суммарное значение power_number
            
            // 3. Обрабатываем NFT чанками
            const powerUtils = require('./power.utils');
            const chunkSize = CONSTANTS.OPTIMIZATION.CHUNK_SIZE;
            
            for (let i = 0; i < originalData.nfts.length; i += chunkSize) {
                // Проверяем флаг отмены
                const calculation = this.activeCalculations.get(calculationId);
                if (calculation && calculation.status === 'cancelled') {
                    this.logger.info(`[${calculationId}] Расчет отменен`);
                    this.updateCalculationStatus(calculationId, 0, 'Расчет отменен', { status: 'cancelled' });
                    this.activeCalculations.delete(calculationId);
                    return;
                }
                
                const chunk = originalData.nfts.slice(i, i + chunkSize);
                
                // Обрабатываем чанк
                for (const originalNft of chunk) {
                    processedCount++;
                    
                    const nft = JSON.parse(JSON.stringify(originalNft));
                    const result = powerUtils.calculateNFTpower(nft, powerData, synergyData);
                    
                    if (result.synergyPower > 0) nftsWithSynergyCount++;
                    if (result.powerNumber > 0) totalPowerNumber += result.powerNumber; // ← ДОБАВЛЕНО: суммируем power_number
                    
                    powerResult[CONSTANTS.COLLECTION_KEYS.NFTS].push(nft);
                }
                
                // Обновляем прогресс
                const progress = 20 + Math.round((processedCount / totalNFTs) * 70);
                if (processedCount % 1000 === 0 || i + chunkSize >= originalData.nfts.length) {
                    this.updateCalculationStatus(
                        calculationId, 
                        progress, 
                        `Обработано ${processedCount}/${totalNFTs} NFT`,
                        { 
                            processed: processedCount,
                            total: totalNFTs,
                            withSynergy: nftsWithSynergyCount,
                            totalPowerNumber: totalPowerNumber, // ← ДОБАВЛЕНО
                            estimatedRemaining: this.estimateRemainingTime(startTime, processedCount, totalNFTs)
                        }
                    );
                }
                
                // Даем event loop передохнуть
                if (chunkSize > 500) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            // 4. Сохраняем результат
            this.updateCalculationStatus(calculationId, 95, 'Сохранение результатов...');
            await powerService.savePowerNFTs(powerResult);
            
            // 5. Завершаем расчет
            const processingTime = Date.now() - startTime;
            const result = {
                totalProcessed: processedCount,
                nftsWithSynergy: nftsWithSynergyCount,
                totalPowerNumber: totalPowerNumber, // ← ДОБАВЛЕНО
                processingTimeMs: processingTime,
                fileSaved: 'all_nft_info_power.json',
                calculationId
            };
            
            this.updateCalculationStatus(
                calculationId, 
                100, 
                'Расчет завершен!',
                result,
                'completed'
            );
            
            this.logger.info(`[${calculationId}] Расчет завершен за ${processingTime}ms`);
            this.logger.info(`[${calculationId}] Общая сумма power_number: ${totalPowerNumber}`);
            
            // Удаляем через 5 минут после завершения
            setTimeout(() => {
                this.activeCalculations.delete(calculationId);
            }, 300000);
            
        } catch (error) {
            this.logger.error(`[${calculationId}] Ошибка расчета:`, error);
            this.updateCalculationStatus(
                calculationId, 
                0, 
                'Ошибка расчета',
                { error: error.message },
                'error'
            );
            
            // Удаляем через 2 минуты после ошибки
            setTimeout(() => {
                this.activeCalculations.delete(calculationId);
            }, 120000);
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
            
            calculation.status = 'cancelled';
            
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
                    error: 'Расчет не найден'
                });
            }
            
            res.json({
                success: true,
                calculationId,
                ...calculation
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
                activeCalculations: this.activeCalculations.size
            };
            
            res.json({
                success: true,
                module: this.config.moduleName,
                status,
                message: 'Режим polling прогресса активен'
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
                    powerNumber: result.powerNumber, // ← ДОБАВЛЕНО
                    totalPower: result.totalPower + result.synergyPower + result.powerNumber // ← ОБНОВЛЕНО
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
    
    // Вспомогательный метод для обновления статуса расчета
    updateCalculationStatus(calculationId, progress, message, details = {}, status = 'running') {
        const calculation = this.activeCalculations.get(calculationId);
        if (calculation) {
            calculation.progress = progress;
            calculation.message = message;
            calculation.details = details;
            calculation.status = status;
            calculation.lastUpdated = Date.now();
            
            if (status === 'completed' || status === 'error' || status === 'cancelled') {
                calculation.endTime = Date.now();
                calculation.result = details;
            }
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