// Конфигурация модуля сортировки
const path = require('path');

// Абсолютные пути
const rootDir = path.join(__dirname, '../../../');

const config = {
    moduleName: 'sort',
    version: '1.0.0',
    enabled: true,
    routesPrefix: '/api/sort',
    description: 'Модуль сортировки NFT по синергиям и атрибутам',
    
    // Пути к файлам данных
    dataFiles: {
        originalNfts: path.join(rootDir, 'nft_data/all_nft_info.json'),
        powerNfts: path.join(rootDir, 'nft_data/all_nft_info_power.json'),
        synergyData: path.join(rootDir, 'nft_data/synergy_state.json'),
        attributesPower: path.join(rootDir, 'nft_data/attributes_power_data.json')
    },
    
    // Настройки пагинации
    pagination: {
        itemsPerPage: 24,
        maxItemsPerPage: 100
    },
    
    // Настройки фильтрации
    filters: {
        maxSynergyLevels: 10,
        maxAttributes: 50
    }
};

module.exports = config;