const express = require('express');
const router = express.Router();
const controller = require('./orc-exchange.controller');

// Информация о модуле
router.get('/info', controller.getModuleInfo);

// Получить доступные Skin Tone
router.get('/available-skin-tones', controller.getAvailableSkinTones);

// Получить реальные данные из NFT файлов (с фильтрацией по Skin Tone)
router.get('/real-data', controller.getRealData);

// Рассчитать мощность команды
router.post('/calculate-team', controller.calculateTeamPower);

// Оптимизировать обмены (теперь с алгоритмами)
router.post('/optimize', controller.optimizeExchanges);

// НОВЫЙ ЭНДПОИНТ: Проанализировать распределение типов
router.post('/analyze-distribution', controller.analyzeDistribution);

// Получить детали NFT по индексу
router.get('/nft/:index', controller.getNFTDetails);

// Состояние модуля (для проверки работы)
router.get('/health', (req, res) => {
    res.json({
        success: true,
        module: 'orc-exchange',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;