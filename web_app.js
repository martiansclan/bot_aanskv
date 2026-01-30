const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Импортируем модуль сортировки (адаптируем для веба)
const synergySortWeb = require('./modules/synergySortWeb.js');

// ====== РОУТЫ ВЕБ-ПРИЛОЖЕНИЯ ======

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница сортировки
app.get('/sort', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sort.html'));
});

// API: Получить данные для сортировки
app.get('/api/sort/data', async (req, res) => {
    try {
        const data = await synergySortWeb.getSortData();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Выполнить сортировку
app.post('/api/sort/execute', async (req, res) => {
    try {
        const params = req.body;
        
        // Валидация параметров
        if (!params.synergyLevel || ![2, 3].includes(params.synergyLevel)) {
            return res.status(400).json({
                success: false,
                error: 'Неверный уровень синергии'
            });
        }

        const results = await synergySortWeb.executeSort(params);
        res.json({ success: true, results });
    } catch (error) {
        console.error('Ошибка сортировки:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Получить результаты пользователя
app.get('/api/sort/results/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const results = await synergySortWeb.getUserResults(userId);
        res.json({ success: true, results });
    } catch (error) {
        console.error('Ошибка получения результатов:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Удалить результаты пользователя
app.delete('/api/sort/results/:userId/:fileType', async (req, res) => {
    try {
        const { userId, fileType } = req.params;
        const result = await synergySortWeb.deleteUserResults(userId, fileType);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Ошибка удаления результатов:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Статистика
app.get('/api/sort/stats', async (req, res) => {
    try {
        const stats = await synergySortWeb.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Получить детали NFT
app.get('/api/sort/nft/:index', async (req, res) => {
    try {
        const { index } = req.params;
        const nft = await synergySortWeb.getNftDetails(index);
        res.json({ success: true, nft });
    } catch (error) {
        console.error('Ошибка получения деталей NFT:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ====== ЗАПУСК СЕРВЕРА ======
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Веб-приложение запущено на порту ${PORT}`);
    console.log(`📱 Откройте в браузере: http://localhost:${PORT}`);
});

// Экспорт для тестов
module.exports = app;