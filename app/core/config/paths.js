const path = require('path');

const PATHS = {
    // Директории
    ROOT_DIR: path.join(__dirname, '../../../'),
    PUBLIC_DIR: path.join(__dirname, '../../../public'),
    NFT_DATA_DIR: path.join(__dirname, '../../../nft_data'),
    MODULES_DIR: path.join(__dirname, '../modules'),
    
    // Файлы данных NFT
    NFT_DATA_FILE: path.join(__dirname, '../../../nft_data', 'all_nft_info.json'),
    NFT_POWER_FILE: path.join(__dirname, '../../../nft_data', 'all_nft_info_power.json'),
    SYNERGY_DATA_FILE: path.join(__dirname, '../../../nft_data', 'synergy_state.json'),
    ATTRIBUTES_POWER_FILE: path.join(__dirname, '../../../nft_data', 'attributes_power_data.json')
};

module.exports = PATHS;