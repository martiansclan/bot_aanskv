// Валидаторы для модуля сортировки
const constants = require('./sort.constants');

class SortValidators {
    validateSortRequest(data) {
        const errors = [];
        
        if (!data) {
            errors.push('Отсутствуют данные запроса');
            return { valid: false, errors };
        }
        
        // Валидация фильтров
        if (data.filters) {
            const filterErrors = this.validateFilters(data.filters);
            errors.push(...filterErrors);
        }
        
        // Валидация страницы
        if (data.page !== undefined) {
            if (typeof data.page !== 'number' || data.page < 1) {
                errors.push('Номер страницы должен быть положительным числом');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    validateFilters(filters) {
        const errors = [];
        
        // Валидация уровней синергий
        if (filters.synergyLevels && Array.isArray(filters.synergyLevels)) {
            filters.synergyLevels.forEach(level => {
                if (!constants.SYNERGY_LEVELS.includes(level)) {
                    errors.push(`Некорректный уровень синергии: ${level}`);
                }
            });
            
            if (filters.synergyLevels.length > 10) {
                errors.push('Слишком много уровней синергий (максимум 10)');
            }
        }
        
        // Валидация Skin Tone
        if (filters.skinTones && Array.isArray(filters.skinTones)) {
            filters.skinTones.forEach(tone => {
                if (typeof tone !== 'string' || tone.length > 100) {
                    errors.push(`Некорректный Skin Tone: ${tone}`);
                }
            });
            
            if (filters.skinTones.length > 50) {
                errors.push('Слишком много Skin Tone (максимум 50)');
            }
        }
        
        // Валидация уровней редкости
        if (filters.rarityLevels && Array.isArray(filters.rarityLevels)) {
            filters.rarityLevels.forEach(rarity => {
                if (!constants.RARITY_LEVELS.includes(rarity)) {
                    errors.push(`Некорректный уровень редкости: ${rarity}`);
                }
            });
        }
        
        // Валидация фильтра продажи
        if (filters.saleFilter && !Object.values(constants.SALE_FILTERS).includes(filters.saleFilter)) {
            errors.push(`Некорректный фильтр продажи: ${filters.saleFilter}`);
        }
        
        return errors;
    }
    
    validateNftId(nftId) {
        const errors = [];
        
        if (!nftId) {
            errors.push('Не указан ID NFT');
            return errors;
        }
        
        if (typeof nftId !== 'string' && typeof nftId !== 'number') {
            errors.push('ID NFT должен быть строкой или числом');
        }
        
        // Проверяем минимальную/максимальную длину
        const idStr = nftId.toString();
        if (idStr.length < 1 || idStr.length > 100) {
            errors.push('ID NFT должен быть от 1 до 100 символов');
        }
        
        return errors;
    }
}

module.exports = new SortValidators();