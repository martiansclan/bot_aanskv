const tribeInfoCollectorService = require('./TribeInfoCollector.service');
const CONSTANTS = require('./TribeInfoCollector.constants');
const fs = require('fs').promises;
const path = require('path');

class TribeInfoCollectorController {
    constructor() {
        this.config = require('./TribeInfoCollector.config');
        this.constants = CONSTANTS;
        this.service = tribeInfoCollectorService;
    }

    // API: Запуск сбора данных
    async startCollection(req, res) {
        try {
            const { startFromStage } = req.body;
            
            console.log(`POST ${this.config.routesPrefix}/start`);
            
            const calculationId = `collect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Немедленно возвращаем ответ с ID расчета
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                calculationId,
                message: CONSTANTS.SUCCESS_MESSAGES.PROCESS_STARTED,
                startedAt: new Date().toISOString(),
                startFromStage: startFromStage || CONSTANTS.COLLECTION_STATUS.STAGE_1
            });
            
            // Запускаем сбор в фоновом режиме
            setTimeout(async () => {
                try {
                    await this.service.collectAllNfts({ 
                        startFromStage: startFromStage || CONSTANTS.COLLECTION_STATUS.STAGE_1,
                        calculationId 
                    });
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
            
            // Если есть ошибка в статусе, все равно возвращаем данные
            if (status.error) {
                return res.json({ 
                    success: true, 
                    module: this.config.moduleName,
                    status: status,
                    warning: 'Файл данных поврежден, показан базовый статус'
                });
            }
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                status 
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения статуса:', error);
            
            // Если это ошибка файла, даем более информативный ответ
            if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
                return res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({ 
                    success: false, 
                    module: this.config.moduleName,
                    error: 'Файл данных не найден',
                    solution: 'Запустите сбор данных для создания файла',
                    endpoint: `${this.config.routesPrefix}/start`
                });
            }
            
            // Возвращаем базовый статус при любой другой ошибке
            const basicStatus = {
                isRunning: this.service.collectionProcess.isRunning,
                currentStage: this.service.collectionProcess.currentStage,
                calculationId: this.service.collectionProcess.calculationId,
                collectionInfo: {
                    totalInCollection: 0,
                    nftsInFile: 0,
                    lastUpdated: null,
                    lastProcessedIndex: 0
                },
                progress: {
                    stage1: { completed: 0, total: 0 },
                    stage2: { completed: 0, total: 0 },
                    stage3: { completed: 0, total: 0 }
                },
                error: error.message
            };
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                status: basicStatus,
                warning: 'Ошибка чтения данных, показан базовый статус'
            });
        }
    }

    // API: Получение прогресса расчета (polling endpoint)
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

    // API: Получение активных расчетов
    async getActiveCalculations(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/active-calculations`);
            
            const status = await this.service.getCollectionStatus();
            
            const activeCalculations = [];
            
            if (status.isRunning && status.calculationId) {
                activeCalculations.push({
                    calculationId: status.calculationId,
                    stage: status.currentStage,
                    stageName: this.service.getStageName(status.currentStage),
                    startedAt: new Date().toISOString(),
                    isRunning: true
                });
            }
            
            res.json({
                success: true,
                module: this.config.moduleName,
                activeCalculations,
                totalActive: activeCalculations.length
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения активных расчетов:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                module: this.config.moduleName,
                error: error.message
            });
        }
    }

    // API: Продолжение сбора
    async continueCollection(req, res) {
        try {
            console.log(`POST ${this.config.routesPrefix}/continue`);
            
            const { calculationId } = req.body;
            
            const newCalculationId = `continue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Немедленно возвращаем ответ с ID расчета
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                calculationId: newCalculationId,
                previousCalculationId: calculationId,
                message: 'Продолжение сбора данных запущено',
                startedAt: new Date().toISOString(),
                canContinue: true
            });
            
            // Запускаем продолжение в фоновом режиме
            setTimeout(async () => {
                try {
                    await this.service.continueCollection({ calculationId });
                } catch (error) {
                    console.error(`❌ Ошибка продолжения сбора:`, error);
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Ошибка продолжения сбора:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }

    // API: Создание сводного файла
    async createSummary(req, res) {
        try {
            console.log(`POST ${this.config.routesPrefix}/create-summary`);
            
            const result = await this.service.createSummaryFile();
            
            if (result.success) {
                res.json({ 
                    success: true, 
                    module: this.config.moduleName,
                    message: CONSTANTS.SUCCESS_MESSAGES.SUMMARY_CREATED,
                    result 
                });
            } else {
                res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                    success: false, 
                    module: this.config.moduleName,
                    error: result.error 
                });
            }
            
        } catch (error) {
            console.error('❌ Ошибка создания сводного файла:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }

    // API: Получение информации о коллекции
    async getCollectionInfo(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/collection-info`);
            
            const result = await this.service.getCollectionInfo();
            
            res.json({ 
                success: result.success, 
                module: this.config.moduleName,
                ...result 
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения информации о коллекции:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }

    // API: Получение текущих данных
    async getCurrentData(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/current-data`);
            
            const data = await this.service.readDataFile();
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                data 
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения текущих данных:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }

    // API: Получение информации о модуле
    async getModuleInfo(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/module-info`);
            
            const status = await this.service.getCollectionStatus();
            
            // Проверяем файлы
            const filesCheck = await this.service.checkFiles();
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                version: this.config.version,
                description: this.config.description,
                enabled: this.config.enabled,
                collectionSettings: this.config.collectionSettings,
                status: status,
                files: filesCheck,
                serverTime: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения информации о модуле:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }

    // API: Проверка файлов
    async checkFiles(req, res) {
        try {
            console.log(`GET ${this.config.routesPrefix}/check-files`);
            
            const result = await this.service.checkFiles();
            
            res.json({ 
                success: true, 
                module: this.config.moduleName,
                ...result,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Ошибка проверки файлов:', error);
            res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                module: this.config.moduleName,
                error: error.message 
            });
        }
    }
}

module.exports = new TribeInfoCollectorController();