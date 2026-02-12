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
            // Регистрируем сервисы БЕЗ инициализации
            // Просто загружаем классы и создаем экземпляры
            
            // Бот
            try {
                const BotService = require('../modules/bot/bot.service');
                const botService = new BotService();
                this.register('bot', botService);
                logger.info('Сервис бота зарегистрирован');
            } catch (error) {
                logger.error('Ошибка регистрации бота:', error.message);
            }
            
            // Сортировка
            try {
                const SortService = require('../modules/sort/sort.service');
                const sortService = new SortService();
                this.register('sort', sortService);
                logger.info('Сервис сортировки зарегистрирован');
            } catch (error) {
                logger.warning('Модуль сортировки не найден:', error.message);
            }
            
            // Power
            try {
                const PowerService = require('../modules/power/power.service');
                const powerService = new PowerService();
                this.register('power', powerService);
                logger.info('Сервис Power зарегистрирован');
            } catch (error) {
                logger.error('Ошибка регистрации Power:', error.message);
            }
            
            // TribeInfoCollector
            try {
                const TribeInfoCollectorService = require('../modules/TribeInfoCollector/TribeInfoCollector.service');
                const tribeService = new TribeInfoCollectorService();
                this.register('TribeInfoCollector', tribeService);
                logger.info('Сервис Tribe Info Collector зарегистрирован');
            } catch (error) {
                logger.error('Ошибка регистрации TribeInfoCollector:', error.message);
            }
            
            // TribeWalletInfoCollector
            try {
                const TribeWalletInfoCollectorService = require('../modules/TribeWalletInfoCollector/TribeWalletInfoCollector.service');
                const tribeWalletService = new TribeWalletInfoCollectorService();
                this.register('TribeWalletInfoCollector', tribeWalletService);
                logger.info('Сервис Tribe Wallet Info Collector зарегистрирован');
            } catch (error) {
                logger.error('Ошибка регистрации TribeWalletInfoCollector:', error.message);
            }
            
            // Orc-exchange
            try {
                const OrcExchangeService = require('../modules/orc-exchange/orc-exchange.service');
                const orcService = new OrcExchangeService();
                this.register('orc-exchange', orcService);
                logger.info('Сервис обмена орками зарегистрирован');
            } catch (error) {
                logger.error('Ошибка регистрации orc-exchange:', error.message);
            }

            this.initialized = true;
            logger.success('Сервисы зарегистрированы');
            
        } catch (error) {
            logger.error('Ошибка регистрации сервисов:', error);
        }
    }
    
    register(name, service) {
        if (this.services.has(name)) {
            logger.warning(`Сервис "${name}" уже зарегистрирован, будет перезаписан`);
        }
        
        this.services.set(name, service);
        logger.debug(`Сервис "${name}" зарегистрирован`);
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
        
        for (const [name, service] of this.services) {
            try {
                if (service && typeof service.shutdown === 'function') {
                    await service.shutdown();
                    logger.info(`Сервис "${name}" остановлен`);
                }
            } catch (error) {
                logger.error(`Ошибка остановки сервиса "${name}":`, error);
            }
        }
        
        this.services.clear();
        this.initialized = false;
        logger.success('Сервисы остановлены');
    }
}

module.exports = new ServiceRegistry();