// app/bootstrap/index.js
const Application = require('./app');
const serviceRegistry = require('./services');

class Bootstrap {
    constructor() {
        this.app = null;
        this.server = null;
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) {
            console.log('⚠️ Bootstrap уже инициализирован');
            return this;
        }
        
        console.log('🚀 Запуск инициализации приложения...');
        console.log('='.repeat(50));
        
        try {
            // 1. Инициализируем сервисы
            console.log('📦 Инициализация сервисов...');
            await serviceRegistry.initialize();
            
            // 2. Создаем Express приложение
            console.log('🌐 Создание Express приложения...');
            this.app = new Application();
            
            this.initialized = true;
            console.log('✅ Bootstrap инициализирован');
            console.log('='.repeat(50));
            
            return this;
        } catch (error) {
            console.error('❌ Критическая ошибка инициализации Bootstrap:', error);
            throw error;
        }
    }
    
    start() {
        if (!this.initialized) {
            throw new Error('Bootstrap не инициализирован. Вызовите initialize() сначала');
        }
        
        this.server = this.app.start();
        
        // Обработка ошибок
        process.on('unhandledRejection', (reason, promise) => {
            console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
        });
        
        process.on('uncaughtException', (error) => {
            console.error('⚠️ Uncaught Exception:', error);
        });
        
        return this.server;
    }
    
    async shutdown() {
        console.log('🛑 Остановка приложения...');
        
        if (this.server) {
            this.server.close();
            console.log('🌐 HTTP сервер остановлен');
        }
        
        if (serviceRegistry.shutdown) {
            await serviceRegistry.shutdown();
        }
        
        this.initialized = false;
        console.log('✅ Приложение остановлено');
    }
    
    getExpressApp() {
        return this.app ? this.app.app : null;
    }
    
    getModule(moduleName) {
        try {
            return serviceRegistry.get(moduleName);
        } catch (error) {
            console.warn(`Модуль "${moduleName}" не найден:`, error.message);
            return null;
        }
    }
    
    getAllModules() {
        return serviceRegistry.getAll();
    }
}

// Экспортируем синглтон
module.exports = new Bootstrap();