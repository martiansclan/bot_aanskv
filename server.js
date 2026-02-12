// server.js
require('dotenv').config();
const bootstrap = require('./app/bootstrap');

async function startServer() {
    try {
        // Инициализируем приложение
        await bootstrap.initialize();
        
        // Запускаем сервер
        bootstrap.start();
        
        console.log('✨ Martian NFT Analyzer полностью запущен! ✨');
        
        // Обработка сигналов остановки
        process.on('SIGINT', async () => {
            console.log('\n🛑 Получен SIGINT сигнал...');
            await bootstrap.shutdown();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Получен SIGTERM сигнал...');
            await bootstrap.shutdown();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Не удалось запустить сервер:', error);
        process.exit(1);
    }
}

startServer();