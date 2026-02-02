const express = require('express');
const router = express.Router();
const powerController = require('./power.controller');

// API маршруты для Power
router.get('/attributes-data', powerController.getAttributesData.bind(powerController));
router.get('/nfts-data', powerController.getNftsData.bind(powerController));
router.get('/nfts-power-data', powerController.getNftsPowerData.bind(powerController));
router.post('/save-nfts', powerController.saveNfts.bind(powerController));
router.post('/calculate', powerController.calculatePower.bind(powerController));
router.get('/synergy-data', powerController.getSynergyData.bind(powerController));
router.get('/compare-files', powerController.compareFiles.bind(powerController));
router.get('/export-power-only', powerController.exportPowerOnly.bind(powerController));
router.get('/optimization-status', powerController.getOptimizationStatus.bind(powerController));
router.delete('/cache', powerController.clearCache.bind(powerController));

// WebSocket маршруты
router.post('/cancel/:calculationId', powerController.cancelCalculation.bind(powerController));
router.get('/status/:calculationId', powerController.getCalculationStatus.bind(powerController));
router.get('/test-single', powerController.testSingleNFT.bind(powerController));

module.exports = router;