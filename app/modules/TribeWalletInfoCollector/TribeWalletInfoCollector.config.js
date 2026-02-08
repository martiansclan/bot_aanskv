// app/modules/TribeWalletInfoCollector/TribeWalletInfoCollector.config.js
module.exports = {
    moduleName: 'TribeWalletInfoCollector',
    description: 'Сбор информации о кошельках TON и их NFT',
    version: '1.0.0',
    enabled: true,
    
    // Префикс для API маршрутов
    routesPrefix: '/api/TribeWalletInfoCollector',
    
    // Настройки API
    api: {
        baseUrl: 'https://tonapi.io/v2',
        timeout: 10000,
        retries: 3,
        delayBetweenRequests: 2000 // Задержка между запросами в мс
    },
    
    // Настройки коллекций
    collections: {
        default: 'EQBGNoXXfQR07HdDhtkmIu1ojTTwcjB0EhHYOMSH3P7sZGJR',
    },
    
    // Папка для сохранения данных
    dataDir: './nft_data/user_files',
    
    // Настройки лимитов
    limits: {
        maxNftsPerRequest: 1000,
        maxAccountsPerBatch: 10
    }
};