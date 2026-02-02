const CONSTANTS = require('./TribeInfoCollector.constants');

class TribeInfoCollectorValidators {
    /**
     * Валидация параметров запуска сбора
     */
    validateStartCollection(data) {
        const errors = [];
        
        if (data.startFromStage !== undefined) {
            const validStages = [
                CONSTANTS.COLLECTION_STATUS.STAGE_1,
                CONSTANTS.COLLECTION_STATUS.STAGE_2,
                CONSTANTS.COLLECTION_STATUS.STAGE_3
            ];
            
            if (!validStages.includes(data.startFromStage)) {
                errors.push('startFromStage должен быть 1, 2 или 3');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Валидация данных NFT
     */
    validateNFTData(nft) {
        const errors = [];
        
        if (!nft || typeof nft !== 'object') {
            errors.push('NFT должен быть объектом');
            return { isValid: false, errors };
        }
        
        if (nft[CONSTANTS.NFT_KEYS.INDEX] === undefined) {
            errors.push('Отсутствует поле index');
        }
        
        if (!nft[CONSTANTS.NFT_KEYS.ADDRESS]) {
            errors.push('Отсутствует поле address');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Валидация данных коллекции
     */
    validateCollectionData(data) {
        const errors = [];
        
        if (!data || typeof data !== 'object') {
            errors.push('Данные должны быть объектом');
            return { isValid: false, errors };
        }
        
        if (!data[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]) {
            errors.push('Отсутствует поле collection_info');
        }
        
        if (!Array.isArray(data[CONSTANTS.COLLECTION_KEYS.NFTS])) {
            errors.push('Поле nfts должно быть массивом');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = new TribeInfoCollectorValidators();