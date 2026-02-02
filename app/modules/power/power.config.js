// app/modules/power/power.config.js
const path = require('path');
const CONSTANTS = require('./power.constants');

module.exports = {
    moduleName: CONSTANTS.MODULE.NAME,
    version: CONSTANTS.MODULE.VERSION,
    enabled: true,
    routesPrefix: '/api/power',
    description: CONSTANTS.MODULE.DESCRIPTION,
    
    // Оптимизированные настройки расчета Power
    optimizationSettings: {
        chunkSize: CONSTANTS.OPTIMIZATION.CHUNK_SIZE,
        maxRetries: CONSTANTS.OPTIMIZATION.MAX_RETRIES,
        delayBetweenChunks: CONSTANTS.OPTIMIZATION.DELAY_BETWEEN_CHUNKS
    },
    
    // Пути к файлам данных
    dataFiles: {
        // Абсолютные пути от корня проекта
        originalNfts: path.join(__dirname, CONSTANTS.FILE_PATHS.ORIGINAL_NFTS),
        powerNfts: path.join(__dirname, CONSTANTS.FILE_PATHS.POWER_NFTS),
        synergyData: path.join(__dirname, CONSTANTS.FILE_PATHS.SYNERGY_DATA),
        attributesPower: path.join(__dirname, CONSTANTS.FILE_PATHS.ATTRIBUTES_POWER)
    }
};