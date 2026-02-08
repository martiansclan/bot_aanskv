
const path = require('path');
const CONSTANTS = require('./TribeInfoCollector.constants');

module.exports = {
    moduleName: CONSTANTS.MODULE.NAME,
    version: CONSTANTS.MODULE.VERSION,
    enabled: true,
    routesPrefix: '/api/TribeInfoCollector',
    description: CONSTANTS.MODULE.DESCRIPTION,
    
    // Настройки сбора
    collectionSettings: {
        batchSize: CONSTANTS.COLLECTION_SETTINGS.BATCH_SIZE,
        delayBetweenBatches: CONSTANTS.COLLECTION_SETTINGS.DELAY_BETWEEN_BATCHES,
        delayBetweenMessages: CONSTANTS.COLLECTION_SETTINGS.DELAY_BETWEEN_MESSAGES,
        maxRetries: CONSTANTS.COLLECTION_SETTINGS.MAX_RETRIES
    },
    
    // Путь к файлу данных (ОДИН ФАЙЛ!)
    dataFile: {
        // Абсолютный путь от корня проекта
        nftData: path.join(__dirname, CONSTANTS.FILE_PATHS.NFT_DATA_FILE)
    },
    
    // Адреса коллекций
    collectionAddress: CONSTANTS.COLLECTION_ADDRESSES.UF,
    
    // API endpoints
    apiEndpoints: CONSTANTS.API_ENDPOINTS,
    
    // API ключи
    apiKeys: {
        tonCenter: CONSTANTS.API_TOKENS.TONCENTER_API_KEY,
        tonapi: CONSTANTS.API_TOKENS.TONAPI_KEY
    },
    
    // Настройки API
    apiSettings: CONSTANTS.API_SETTINGS
};
