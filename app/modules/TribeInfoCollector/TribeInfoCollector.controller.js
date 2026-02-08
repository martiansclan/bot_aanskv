
const tribeInfoCollectorService = require('./TribeInfoCollector.service');
const CONSTANTS = require('./TribeInfoCollector.constants');

class TribeInfoCollectorController {
    constructor() {
        this.config = require('./TribeInfoCollector.config');
        this.constants = CONSTANTS;
        this.service = tribeInfoCollectorService;
    }

    // API: Запуск сбора данных
    async startCollection(req, res) {
        try {
            console.log(`POST ${this.config.routesPrefix}/start`);
            
            const calculationId = `collect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Немедленно возвращаем ответ с ID расчета
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                calculationId,
                message: 'Сбор данных запущен',
                startedAt: new Date().toISOString()
            });
            
            // Запускаем сбор в фоновом режиме
            setTimeout(async () => {
                try {
                    await this.service.collectAllNfts({ calculationId });
                } catch (error) {
                    console.error(`❌ Ошибка фонового сбора:`, error);
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Ошибка запуска сбора:', error);
            
            if (error.message === CONSTANTS.ERROR_MESSAGES.PROCESS_ALREADY_RUNNING) {
                res.status(CONSTANTS.HTTP_STATUS.CONFLICT).json({ 
                    success: false, 
                    module: this.config.moduleName,
                    error: error.message 
                });
            } else {
                res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                    success: false, 
                    module: this.config.moduleName,
                    error: error.message 
                });
            }
        }
    }

    // API: Остановка сбора данных
    async stopCollection(req, res) {
        try {
            console.log(`POST ${this.config.routesPrefix}/stop`);
            
            const result = await this.service.stopCollection();
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                ...result 
            });
            
        } catch (error) {
            console.error('❌ Ошибка остановки сбора:', error);
            
            if (error.message === CONSTANTS.ERROR_MESSAGES.PROCESS_NOT_RUNNING) {
                res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({ 
                    success: false, 
                    module: this.config.moduleName,
                    error: error.message 
                });
            } else {
                res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                    success: false, 
                    module: this.config.moduleName,
                    error: error.message 
                });
            }
        }
    }

    // API: Получение статуса сбора
    async getStatus(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/status`);
            
            const status = await this.service.getCollectionStatus();
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                status 
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения статуса:', error);
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                status: {
                    isRunning: false,
                    calculationId: null,
                    collectionInfo: {
                        totalInCollection: 0,
                        nftsInFile: 0,
                        lastUpdated: null,
                        lastProcessedIndex: 0
                    }
                }
            });
        }
    }

    // API: Получение прогресса расчета
    async getProgress(req, res) {
        try {
            const { calculationId } = req.query;
            
            if (!calculationId) {
                return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    module: this.config.moduleName,
                    error: 'Не указан calculationId'
                });
            }
            
            console.log(`GET ${this.config.routesPrefix}/progress?calculationId=${calculationId}`);
            
            const progress = this.service.getProgress(calculationId);
            
            res.json({
                success: true,
                module: this.config.moduleName,
                calculationId,
                progress
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения прогресса:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                module: this.config.moduleName,
                error: error.message
            });
        }
    }

    // API: Проверка целостности данных
    async checkIntegrity(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/check-integrity`);
            
            // Проверяем параметр autoFill (по умолчанию true)
            const autoFill = req.query.autoFill !== 'false';
            
            const result = await this.service.checkDataIntegrity(autoFill);
            
            res.json({ 
                success: result.success, 
                module: this.config.moduleName,
                message: result.message,
                statistics: result.statistics,
                hasMissingIndices: result.missingIndices ? result.missingIndices.length > 0 : false,
                missingCount: result.missingIndices ? result.missingIndices.length : 0,
                duplicateCount: result.duplicateIndices ? result.duplicateIndices.length : 0,
                isSequential: result.isSequential,
                autoFilled: result.autoFilled || false,
                fillResult: result.fillResult,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Ошибка проверки целостности:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }

    // API: Проверка файла
    async checkFile(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/check-file`);
            
            const result = await this.service.checkFile();
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                ...result,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Ошибка проверки файла:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
}

module.exports = new TribeInfoCollectorController();
