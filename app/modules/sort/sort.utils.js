// Утилиты модуля сортировки

class SortUtils {
    // Группировка NFT по атрибутам
    static groupByAttribute(nfts, attributeName) {
        const groups = {};
        
        nfts.forEach(nft => {
            const attributeValue = nft.attributes?.[attributeName] || 
                                 nft.attributes?.[attributeName.toLowerCase()] || 
                                 'Unknown';
            
            if (!groups[attributeValue]) {
                groups[attributeValue] = [];
            }
            
            groups[attributeValue].push(nft);
        });
        
        return groups;
    }
    
    // Подсчет статистики по группам
    static calculateGroupStats(groups) {
        const stats = {};
        
        Object.entries(groups).forEach(([groupName, groupItems]) => {
            stats[groupName] = {
                count: groupItems.length,
                avgSynergies: this.calculateAverageSynergies(groupItems),
                rarityDistribution: this.calculateRarityDistribution(groupItems)
            };
        });
        
        return stats;
    }
    
    // Расчет среднего количества синергий
    static calculateAverageSynergies(nfts) {
        if (nfts.length === 0) return 0;
        
        const totalSynergies = nfts.reduce((sum, nft) => {
            const synergies = nft.synergies_count || {};
            return sum + Object.values(synergies).reduce((a, b) => a + b, 0);
        }, 0);
        
        return Math.round((totalSynergies / nfts.length) * 100) / 100;
    }
    
    // Распределение редкости
    static calculateRarityDistribution(nfts) {
        const distribution = {};
        
        nfts.forEach(nft => {
            // Здесь должен быть расчет редкости NFT
            // Для упрощения используем псевдо-расчет
            const rarity = 'Common'; // Замените на реальный расчет
            distribution[rarity] = (distribution[rarity] || 0) + 1;
        });
        
        return distribution;
    }
    
    // Создание уникального ключа для фильтров
    static createFilterKey(filters) {
        const sortedFilters = {};
        
        // Сортируем массивы для консистентности
        Object.keys(filters).sort().forEach(key => {
            if (Array.isArray(filters[key])) {
                sortedFilters[key] = [...filters[key]].sort();
            } else {
                sortedFilters[key] = filters[key];
            }
        });
        
        return JSON.stringify(sortedFilters);
    }
    
    // Форматирование результатов для клиента
    static formatResultsForClient(results) {
        if (!results || !results.data) return results;
        
        return {
            ...results,
            data: results.data.map(nft => ({
                id: nft.id || nft.token_id,
                name: nft.name || `NFT #${nft.id || nft.token_id}`,
                image_url: nft.image_url,
                attributes: nft.attributes || {},
                synergies_count: nft.synergies_count || {},
                sale_data: nft.sale_data || null,
                rarity: nft.calculatedRarity || 'Common',
                total_synergies: nft.totalSynergies || 0
            }))
        };
    }
    
    // Проверка кэша
    static isCacheValid(cacheTimestamp, ttl) {
        if (!cacheTimestamp) return false;
        
        const now = new Date();
        const cacheAge = now - new Date(cacheTimestamp);
        return cacheAge < ttl;
    }
}

module.exports = SortUtils;