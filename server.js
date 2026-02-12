// server.js
require('dotenv').config();
const bootstrap = require('./app/bootstrap');

async function startServer() {
    try {
        await bootstrap.initialize();
        bootstrap.start();
        
        console.log('✅ Сервер успешно запущен и готов к работе');
        
        // ЕДИНСТВЕННЫЙ обработчик сигналов
        let isShuttingDown = false;
        
        const shutdownHandler = async (signal) => {
            // Предотвращаем множественные вызовы
            if (isShuttingDown) {
                console.log(`⚠️ ${signal} уже обрабатывается, игнорируем...`);
                return;
            }
            
            isShuttingDown = true;
            console.log(`\n🛑 Получен ${signal} сигнал...`);
            
            // Удаляем обработчики чтобы избежать повторных вызовов
            process.off('SIGINT', shutdownHandler);
            process.off('SIGTERM', shutdownHandler);
            
            // Даем время на завершение текущих операций
            setTimeout(async () => {
                await bootstrap.shutdown();
                process.exit(0);
            }, 100);
        };
        
        process.on('SIGINT', shutdownHandler);
        process.on('SIGTERM', shutdownHandler);
        
    } catch (error) {
        console.error('❌ Не удалось запустить сервер:', error);
        process.exit(1);
    }
}

startServer();