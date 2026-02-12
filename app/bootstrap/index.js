// app/bootstrap/index.js
const Application = require('./app');
const serviceRegistry = require('./services');

class Bootstrap {
    constructor() {
        this.app = null;
        this.server = null;
        this.initialized = false;
        this.isShuttingDown = false;
    }
    
    async initialize() {
        if (this.initialized) {
            console.log('⚠️ Bootstrap уже инициализирован');
            return this;
        }
        
        console.log('🚀 Запуск инициализации приложения...');
        console.log('='.repeat(50));
        
        try {
            console.log('🌐 Создание Express приложения...');
            this.app = new Application();
            
            console.log('📦 Инициализация сервисов...');
            await serviceRegistry.initialize(this.app.app);
            
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
        return this.server;
    }
    
    async shutdown() {
        // КРИТИЧЕСКИ ВАЖНО: предотвращаем множественные вызовы
        if (this.isShuttingDown) {
            console.log('⚠️ Процесс завершения уже запущен, игнорируем...');
            return;
        }
        
        this.isShuttingDown = true;
        console.log('🛑 Остановка приложения...');
        
        try {
            // 1. Останавливаем сервисы
            if (serviceRegistry && typeof serviceRegistry.shutdown === 'function') {
                await serviceRegistry.shutdown();
                console.log('✅ Сервисы остановлены');
            }
            
            // 2. Останавливаем HTTP сервер
            if (this.server) {
                try {
                    // ПРОВЕРЯЕМ что это HTTP сервер
                    if (this.server && typeof this.server.close === 'function') {
                        await new Promise((resolve) => {
                            this.server.close(() => {
                                console.log('🌐 HTTP сервер остановлен');
                                resolve();
                            });
                        });
                    } else {
                        console.log('⚠️ Сервер уже остановлен или не является HTTP сервером');
                    }
                } catch (error) {
                    console.error('❌ Ошибка при остановке HTTP сервера:', error.message);
                }
            }
            
            this.initialized = false;
            console.log('✅ Приложение остановлено');
            
        } catch (error) {
            console.error('❌ Ошибка при остановке приложения:', error.message);
        } finally {
            this.isShuttingDown = false;
        }
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

module.exports = new Bootstrap();