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
    
    // Настройки расчета power_number
    powerNumberSettings: {
        specialNumbers: {
            '0-9': 1000,
            '11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 222, 333, 444, 555, 666, 777, 888, 999, 1111, 2222, 3333, 4444, 5555, 6666, 7777, 8888, 9999': 500,
            '11111': 5000
        },
        defaultPower: 0
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