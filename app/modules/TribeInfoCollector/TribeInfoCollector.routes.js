const express = require('express');
const router = express.Router();
const tribeInfoCollectorController = require('./TribeInfoCollector.controller');

// API маршруты для сбора информации о NFT
router.post('/start', tribeInfoCollectorController.startCollection.bind(tribeInfoCollectorController));
router.post('/stop', tribeInfoCollectorController.stopCollection.bind(tribeInfoCollectorController));
router.get('/status', tribeInfoCollectorController.getStatus.bind(tribeInfoCollectorController));
router.get('/progress', tribeInfoCollectorController.getProgress.bind(tribeInfoCollectorController));
router.get('/check-integrity', tribeInfoCollectorController.checkIntegrity.bind(tribeInfoCollectorController));
router.get('/check-file', tribeInfoCollectorController.checkFile.bind(tribeInfoCollectorController));

module.exports = router;