// app/modules/TribeWalletInfoCollector/TribeWalletInfoCollector.routes.js
const express = require('express');
const router = express.Router();
const controller = require('./TribeWalletInfoCollector.controller.js');

// Для загрузки файлов
const fileUpload = require('express-fileupload');

// Сбор информации о кошельках - ТОЛЬКО ОДИН МАРШРУТ
router.post('/', fileUpload(), async (req, res) => {
    // Если есть файл в запросе, это загрузка
    if (req.files && req.files.file) {
        return controller.uploadWalletsFile(req, res);
    }
    // Иначе это сбор данных
    return controller.collectWalletsInfo(req, res);
});

// Скачивание файла с данными
router.get('/download/:userId/:type', controller.downloadFile);

// Проверка здоровья
router.get('/health', controller.healthCheck);

module.exports = router;