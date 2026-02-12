// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const bootstrap = require('./app/bootstrap');

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Экспортируем app для использования в bot.js
module.exports = { app };

async function startServer() {
    try {
        // Инициализируем приложение
        await bootstrap.initialize();
        
        // Запускаем сервер
        bootstrap.start();
        
        console.log('✨ Martian NFT Analyzer полностью запущен! ✨');
        console.log(`🌍 Web App: ${process.env.APP_URL || 'https://bot-aanskv.onrender.com'}`);
        console.log(`🤖 Telegram: @zargates_martians_bot`);

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

// Запускаем сервер
startServer();