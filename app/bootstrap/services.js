// app/bootstrap/services.js
const logger = require('../core/utils/logger');

class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) {
            logger.warning('Сервисы уже инициализированы');
            return;
        }
        
        logger.info('Инициализация сервисов...');
        
        try {

             // ===== ИНИЦИАЛИЗИРУЕМ БОТА =====
            try {
                const botService = require('../modules/bot/bot.service');
                const botInitialized = await botService.initialize();
                if (botInitialized) {
                    this.register('bot', botService);
                    logger.success('✅ Telegram бот инициализирован');
                }
            } catch (error) {
                logger.error('❌ Ошибка инициализации бота:', error.message);
            }

            // Инициализируем модуль сортировки
            try {
                const sortService = require('../modules/sort/sort.service');
                const sortInitialized = await sortService.initialize();
                if (sortInitialized) {
                    this.register('sort', sortService);
                    logger.success('Сервис сортировки инициализирован');
                } else {
                    logger.warning('Сервис сортировки не инициализирован, продолжаем без него');
                }
            } catch (error) {
                logger.warning('Модуль сортировки не найден или произошла ошибка:', error.message);
            }
            
            // Инициализируем модуль power
            try {
                const powerService = require('../modules/power/power.service');
                
                // Проверяем, есть ли метод initialize()
                if (typeof powerService.initialize === 'function') {
                    const powerInitialized = await powerService.initialize();
                    if (powerInitialized) {
                        this.register('power', powerService);
                        logger.success('Сервис Power инициализирован');
                    } else {
                        logger.warning('Сервис Power не инициализирован, но доступен');
                        this.register('power', powerService);
                    }
                } else {
                    // Если нет метода initialize(), все равно регистрируем сервис
                    this.register('power', powerService);
                    logger.info('Сервис Power зарегистрирован (без метода initialize)');
                }
            } catch (error) {
                logger.error('Ошибка инициализации модуля Power:', error.message);
            }

            // Инициализируем модуль TribeInfoCollector
            try {
                const tribeInfoCollectorService = require('../modules/TribeInfoCollector/TribeInfoCollector.service');
                
                // Проверяем, есть ли метод initialize()
                if (typeof tribeInfoCollectorService.initialize === 'function') {
                    const tribeInitialized = await tribeInfoCollectorService.initialize();
                    if (tribeInitialized) {
                        this.register('TribeInfoCollector', tribeInfoCollectorService);
                        logger.success('Сервис Tribe Info Collector инициализирован');
                    } else {
                        logger.warning('Сервис Tribe Info Collector не инициализирован, но доступен');
                        this.register('TribeInfoCollector', tribeInfoCollectorService);
                    }
                } else {
                    // Если нет метода initialize(), все равно регистрируем сервис
                    this.register('TribeInfoCollector', tribeInfoCollectorService);
                    logger.info('Сервис Tribe Info Collector зарегистрирован (без метода initialize)');
                }
            } catch (error) {
                logger.error('Ошибка инициализации модуля Tribe Info Collector:', error.message);
                // Пробуем зарегистрировать даже при ошибке
                try {
                    const tribeInfoCollectorService = require('../modules/TribeInfoCollector/TribeInfoCollector.service');
                    this.register('TribeInfoCollector', tribeInfoCollectorService);
                    logger.info('Сервис Tribe Info Collector зарегистрирован (несмотря на ошибку инициализации)');
                } catch (regError) {
                    logger.error('Не удалось зарегистрировать сервис Tribe Info Collector:', regError.message);
                }
            }
            
            // Инициализируем модуль TribeWalletInfoCollector
            try {
                const tribeWalletInfoCollectorService = require('../modules/TribeWalletInfoCollector/TribeWalletInfoCollector.service');
                
                // Проверяем, есть ли метод initialize()
                if (typeof tribeWalletInfoCollectorService.initialize === 'function') {
                    const tribeWalletInitialized = await tribeWalletInfoCollectorService.initialize();
                    if (tribeWalletInitialized) {
                        this.register('TribeWalletInfoCollector', tribeWalletInfoCollectorService);
                        logger.success('Сервис Tribe Wallet Info Collector инициализирован');
                    } else {
                        logger.warning('Сервис Tribe Wallet Info Collector не инициализирован, но доступен');
                        this.register('TribeWalletInfoCollector', tribeWalletInfoCollectorService);
                    }
                } else {
                    // Если нет метода initialize(), все равно регистрируем сервис
                    this.register('TribeWalletInfoCollector', tribeWalletInfoCollectorService);
                    logger.info('Сервис Tribe Wallet Info Collector зарегистрирован');
                }
            } catch (error) {
                logger.error('Ошибка инициализации модуля Tribe Wallet Info Collector:', error.message);
                // Пробуем зарегистрировать даже при ошибке
                try {
                    const tribeWalletInfoCollectorService = require('../modules/TribeWalletInfoCollector/TribeWalletInfoCollector.service');
                    this.register('TribeWalletInfoCollector', tribeWalletInfoCollectorService);
                    logger.info('Сервис Tribe Wallet Info Collector зарегистрирован (несмотря на ошибку инициализации)');
                } catch (regError) {
                    logger.error('Не удалось зарегистрировать сервис Tribe Wallet Info Collector:', regError.message);
                }
            }
            
            // Инициализируем модуль обмена орками
            try {
                const orcExchangeService = require('../modules/orc-exchange/orc-exchange.service');
                
                // Проверяем, есть ли метод initialize()
                if (typeof orcExchangeService.initialize === 'function') {
                    const orcExchangeInitialized = await orcExchangeService.initialize();
                    if (orcExchangeInitialized) {
                        this.register('orc-exchange', orcExchangeService);
                        logger.success('Сервис обмена орками инициализирован');
                    } else {
                        logger.warning('Сервис обмена орками не инициализирован, но доступен');
                        this.register('orc-exchange', orcExchangeService);
                    }
                } else {
                    // Если нет метода initialize(), все равно регистрируем сервис
                    this.register('orc-exchange', orcExchangeService);
                    logger.info('Сервис обмена орками зарегистрирован');
                }
            } catch (error) {
                logger.error('Ошибка инициализации модуля обмена орками:', error.message);
                // Пробуем зарегистрировать даже при ошибке
                try {
                    const orcExchangeService = require('../modules/orc-exchange/orc-exchange.service');
                    this.register('orc-exchange', orcExchangeService);
                    logger.info('Сервис обмена орками зарегистрирован (несмотря на ошибку инициализации)');
                } catch (regError) {
                    logger.error('Не удалось зарегистрировать сервис обмена орками:', regError.message);
                }
            }

            this.initialized = true;
            logger.success('Сервисы инициализированы');
            
        } catch (error) {
            logger.error('Ошибка инициализации сервисов:', error);
            // Не завершаем процесс, продолжаем работу
        }
    }
    
    register(name, service) {
        if (this.services.has(name)) {
            logger.warning(`Сервис "${name}" уже зарегистрирован, будет перезаписан`);
        }
        
        this.services.set(name, service);
        logger.info(`Сервис "${name}" зарегистрирован`);
    }
    
    get(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Сервис "${name}" не найден`);
        }
        return service;
    }
    
    getAll() {
        return Object.fromEntries(this.services);
    }
    
    async shutdown() {
        logger.info('Завершение работы сервисов...');
         // Останавливаем бота
        try {
            const botService = this.services.get('bot');
            if (botService && botService.shutdown) {
                await botService.shutdown();
            }
        } catch (error) {
            logger.error('Ошибка остановки бота:', error);
        }
        this.services.clear();
        this.initialized = false;
        logger.success('Сервисы остановлены');
    }
}

module.exports = new ServiceRegistry();