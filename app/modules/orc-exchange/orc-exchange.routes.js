const express = require('express');
const router = express.Router();
const controller = require('./orc-exchange.controller');

// Информация о модуле
router.get('/info', controller.getModuleInfo);

// Получить тестовые данные
router.get('/test-data', controller.getTestData);

// Рассчитать мощность команды
router.post('/calculate-team', controller.calculateTeamPower);

// Оптимизировать обмены
router.post('/optimize', controller.optimizeExchanges);

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