const express = require('express');
const router = express.Router();
const tribeInfoCollectorController = require('./TribeInfoCollector.controller');

// API маршруты для сбора информации о NFT
router.post('/start', tribeInfoCollectorController.startCollection.bind(tribeInfoCollectorController));
router.post('/stop', tribeInfoCollectorController.stopCollection.bind(tribeInfoCollectorController));
router.get('/status', tribeInfoCollectorController.getStatus.bind(tribeInfoCollectorController));
router.post('/continue', tribeInfoCollectorController.continueCollection.bind(tribeInfoCollectorController));
router.get('/collection-info', tribeInfoCollectorController.getCollectionInfo.bind(tribeInfoCollectorController));
router.get('/current-data', tribeInfoCollectorController.getCurrentData.bind(tribeInfoCollectorController));



module.exports = router;