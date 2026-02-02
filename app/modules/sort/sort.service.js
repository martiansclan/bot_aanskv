// Сервис сортировки NFT
const fs = require('fs').promises;
const path = require('path');

// Простой логгер для сервиса
const createLogger = (moduleName) => ({
    info: (msg, ...args) => console.log(`[${moduleName}] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[${moduleName} ERROR] ${msg}`, ...args),
    success: (msg, ...args) => console.log(`[${moduleName} SUCCESS] ${msg}`, ...args),
    warning: (msg, ...args) => console.warn(`[${moduleName} WARNING] ${msg}`, ...args)
});

class SortService {
    constructor() {
        this.config = require('./sort.config');
        this.dataCache = {
            nfts: null,              // Теперь из all_nft_info_power.json
            synergyData: null,
            attributesPower: null,
            lastUpdated: null,
            nftIndex: new Map()      // Для быстрого поиска по ID/индексу
        };
        this.logger = createLogger('SORT SERVICE');
    }
    
    async initialize() {
        try {
            this.logger.info('Инициализация сервиса сортировки...');
            
            // 1. Загружаем данные NFT из файла с Power (all_nft_info_power.json)
            try {
                const nftData = await fs.readFile(this.config.dataFiles.powerNfts, 'utf8');
                const parsedData = JSON.parse(nftData);
                this.dataCache.nfts = parsedData.nfts || [];
                
                // Создаем индекс для быстрого поиска
                this.createNFTIndex();
                
                this.logger.info(`Загружено ${this.dataCache.nfts.length} NFT с Power данными`);
            } catch (error) {
                this.logger.error('Ошибка загрузки NFT с Power:', error.message);
                // Пробуем загрузить обычный файл как fallback
                try {
                    const nftData = await fs.readFile(this.config.dataFiles.originalNfts, 'utf8');
                    const parsedData = JSON.parse(nftData);
                    this.dataCache.nfts = parsedData.nfts || [];
                    this.createNFTIndex();
                    this.logger.info(`Загружено ${this.dataCache.nfts.length} NFT из резервного файла`);
                } catch (fallbackError) {
                    this.logger.error('Ошибка загрузки резервного файла:', fallbackError.message);
                    this.dataCache.nfts = [];
                }
            }
            
            // 2. Загружаем данные синергий
            try {
                const synergyData = await fs.readFile(this.config.dataFiles.synergyData, 'utf8');
                this.dataCache.synergyData = JSON.parse(synergyData);
                this.logger.info('Данные синергий загружены');
            } catch (error) {
                this.logger.error('Ошибка загрузки синергий:', error.message);
                this.dataCache.synergyData = {};
            }
            
            // 3. Загружаем данные атрибутов
            try {
                const attributesData = await fs.readFile(this.config.dataFiles.attributesPower, 'utf8');
                this.dataCache.attributesPower = JSON.parse(attributesData);
                this.logger.info('Данные атрибутов загружены');
            } catch (error) {
                this.logger.error('Ошибка загрузки атрибутов:', error.message);
                this.dataCache.attributesPower = {};
            }
            
            this.dataCache.lastUpdated = new Date();
            
            this.logger.success('Сервис сортировки инициализирован');
            return true;
        } catch (error) {
            this.logger.error('Ошибка инициализации сервиса сортировки:', error);
            return false;
        }
    }
    
    // Создаем индекс для быстрого поиска NFT
    createNFTIndex() {
        this.dataCache.nftIndex = new Map();
        
        if (!this.dataCache.nfts || !Array.isArray(this.dataCache.nfts)) {
            return;
        }
        
        this.dataCache.nfts.forEach((nft, index) => {
            // Индекс по ID/индексу
            if (nft.index !== undefined) {
                this.dataCache.nftIndex.set(`index:${nft.index}`, index);
            }
            
            // Индекс по имени (для поиска)
            if (nft.name) {
                const nameLower = nft.name.toLowerCase();
                this.dataCache.nftIndex.set(`name:${nameLower}`, index);
                
                // Также индексируем части имени
                const nameParts = nameLower.split(' ');
                nameParts.forEach(part => {
                    if (part.length > 2) {
                        const key = `name_part:${part}`;
                        const existing = this.dataCache.nftIndex.get(key) || [];
                        existing.push(index);
                        this.dataCache.nftIndex.set(key, existing);
                    }
                });
            }
            
            // Индекс по атрибутам
            if (nft.attributes && Array.isArray(nft.attributes)) {
                nft.attributes.forEach(attr => {
                    if (attr.value) {
                        const attrKey = `attr:${attr.value.toLowerCase()}`;
                        const existing = this.dataCache.nftIndex.get(attrKey) || [];
                        existing.push(index);
                        this.dataCache.nftIndex.set(attrKey, existing);
                    }
                });
            }
        });
        
        this.logger.info(`Создан индекс для ${this.dataCache.nfts.length} NFT`);
    }
    
    async getFilterOptions() {
        try {
            if (!this.dataCache.attributesPower || !this.dataCache.synergyData) {
                await this.initialize();
            }
            
            const attributesData = this.dataCache.attributesPower?.attributes_power?.attributes || {};
            
            // Получаем все уровни синергий из NFT (уникальные значения из attribute_synergy.rarity)
            const synergyLevels = this.extractSynergyLevelsFromNFTs();
            
            // Получаем все категории атрибутов
            const attributeCategories = {};
            Object.entries(attributesData).forEach(([category, values]) => {
                attributeCategories[category] = Object.keys(values || {}).sort();
            });
            
            // Получаем все уникальные значения атрибутов
            const allUniqueAttributeValues = this.getAllUniqueAttributeValues();
            
            const options = {
                // Уровни синергий из attribute_synergy.rarity
                synergyLevels: synergyLevels,
                
                // Уровни редкости из файла
                rarityLevels: this.extractRarityLevels(),
                
                // Категории атрибутов с их значениями
                attributeCategories: attributeCategories,
                
                // Все уникальные значения атрибутов
                allAttributeValues: allUniqueAttributeValues,
                
                // Фильтры продажи
                saleFilters: ['all', 'onSale']
            };
            
            this.logger.info(`Опции фильтрации: 
                Уровни синергий: ${options.synergyLevels.length}
                Категории: ${Object.keys(options.attributeCategories).length}
                Уникальные значения атрибутов: ${options.allAttributeValues.length}
                Уровни редкости: ${options.rarityLevels.length}`);
            
            return options;
        } catch (error) {
            this.logger.error('Ошибка получения опций фильтрации:', error);
            throw error;
        }
    }
    
    // Извлекаем уровни синергий из attribute_synergy.rarity
    extractSynergyLevelsFromNFTs() {
        if (!this.dataCache.nfts || !Array.isArray(this.dataCache.nfts)) {
            return ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C']; // Fallback
        }
        
        const synergySet = new Set();
        
        this.dataCache.nfts.forEach(nft => {
            if (nft.attribute_synergy && Array.isArray(nft.attribute_synergy)) {
                nft.attribute_synergy.forEach(synergy => {
                    if (synergy.rarity) {
                        // Конвертируем числовой рейтинг в буквенный
                        const level = this.convertRarityToLevel(synergy.rarity);
                        if (level) {
                            synergySet.add(level);
                        }
                    }
                });
            }
        });
        
        // Если не нашли синергий, используем fallback
        if (synergySet.size === 0) {
            return ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C'];
        }
        
        // Сортируем по важности (S+ самый высокий)
        const sortedLevels = Array.from(synergySet).sort((a, b) => {
            const order = { 'S+': 0, 'S': 1, 'A+': 2, 'A': 3, 'B+': 4, 'B': 5, 'C+': 6, 'C': 7 };
            return (order[a] || 99) - (order[b] || 99);
        });
        
        return sortedLevels;
    }
    
    // Конвертируем числовой рейтинг в буквенный уровень
    convertRarityToLevel(rarity) {
        if (typeof rarity === 'number') {
            rarity = rarity.toString();
        }
        
        const rarityMap = {
            '3': 'S',
            '2': 'A',
            '1': 'B'
        };
        
        // Если рейтинг содержит знак "+" или можно добавить на основе power
        return rarityMap[rarity] || 'C';
    }
    
    // Получение всех уникальных значений атрибутов
    getAllUniqueAttributeValues() {
        if (!this.dataCache.attributesPower?.attributes_power?.attributes) {
            return [];
        }
        
        const uniqueValues = new Set();
        const attributes = this.dataCache.attributesPower.attributes_power.attributes;
        
        Object.values(attributes).forEach(category => {
            if (typeof category === 'object') {
                Object.keys(category).forEach(value => {
                    uniqueValues.add(value);
                });
            }
        });
        
        return Array.from(uniqueValues).sort();
    }
    
    extractRarityLevels() {
        if (!this.dataCache.attributesPower?.attributes_power?.rarity_power) {
            return ['Mythical+', 'Mythical', 'Legendary', 'Epic', 'Common'];
        }
        
        const rarityPower = this.dataCache.attributesPower.attributes_power.rarity_power;
        const rarityLevels = Object.keys(rarityPower);
        
        return rarityLevels.sort((a, b) => {
            return rarityPower[b] - rarityPower[a];
        });
    }
    
    async sortNFTs(filters, page = 1) {
        try {
            this.logger.info('Запуск сортировки с фильтрами:', filters);
            
            if (!this.dataCache.nfts) {
                await this.initialize();
            }
            
            let filteredNFTs = this.dataCache.nfts || [];
            
            // 1. Глобальный поиск (если есть)
            if (filters.searchQuery && filters.searchQuery.trim()) {
                filteredNFTs = this.applyGlobalSearch(filteredNFTs, filters.searchQuery);
            }
            
            // 2. Применяем фильтры
            filteredNFTs = this.applyFilters(filteredNFTs, filters);
            
            // 3. Сортируем
            filteredNFTs = this.sortNFTsBySynergies(filteredNFTs);
            
            // 4. Пагинация
            const itemsPerPage = 24;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedItems = filteredNFTs.slice(startIndex, endIndex);
            
            // 5. Форматируем результат для клиента
            const formattedItems = this.formatNFTsForClient(paginatedItems);
            
            // Статистика
            const stats = {
                totalNFTs: filteredNFTs.length,
                totalPages: Math.ceil(filteredNFTs.length / itemsPerPage),
                currentPage: page
            };
            
            this.logger.success(`Сортировка завершена. Найдено: ${filteredNFTs.length} NFT`);
            
            return {
                success: true,
                data: formattedItems,
                pagination: stats,
                filtersApplied: filters
            };
            
        } catch (error) {
            this.logger.error('Ошибка сортировки NFT:', error);
            throw error;
        }
    }
    
    // Глобальный поиск по имени, ID, атрибутам
    applyGlobalSearch(nfts, searchQuery) {
        if (!searchQuery || searchQuery.trim() === '') {
            return nfts;
        }
        
        const query = searchQuery.toLowerCase().trim();
        
        // Если это число (возможно ID/index)
        if (!isNaN(query)) {
            const index = parseInt(query);
            return nfts.filter(nft => nft.index === index);
        }
        
        // Поиск по имени
        if (query.length >= 2) {
            return nfts.filter(nft => {
                // Поиск по имени
                if (nft.name && nft.name.toLowerCase().includes(query)) {
                    return true;
                }
                
                // Поиск по атрибутам
                if (nft.attributes && Array.isArray(nft.attributes)) {
                    return nft.attributes.some(attr => 
                        attr.value && attr.value.toLowerCase().includes(query)
                    );
                }
                
                return false;
            });
        }
        
        return nfts;
    }
    
    applyFilters(nfts, filters) {
        let filtered = [...nfts];
        
        // 1. Фильтр по уровням синергий (из attribute_synergy.rarity)
        if (filters.synergyLevels && filters.synergyLevels.length > 0) {
            filtered = filtered.filter(nft => {
                return this.nftHasSynergyLevels(nft, filters.synergyLevels);
            });
        }
        
        // 2. Фильтр по уровням редкости (общая редкость NFT)
        if (filters.rarityLevels && filters.rarityLevels.length > 0) {
            filtered = filtered.filter(nft => {
                const nftRarity = this.calculateNftRarity(nft);
                return filters.rarityLevels.includes(nftRarity);
            });
        }
        
        // 3. Фильтр по категориям атрибутов
        if (filters.attributeFilters && Object.keys(filters.attributeFilters).length > 0) {
            filtered = filtered.filter(nft => {
                return this.nftMatchesAttributeFilters(nft, filters.attributeFilters);
            });
        }
        
        // 4. Фильтр по отдельным атрибутам (из списка "По атрибутам")
        if (filters.attributeValues && filters.attributeValues.length > 0) {
            filtered = filtered.filter(nft => {
                return this.nftHasAttributeValues(nft, filters.attributeValues);
            });
        }
        
        return filtered;
    }
    
    // Проверяет, имеет ли NFT указанные уровни синергий
    nftHasSynergyLevels(nft, requiredLevels) {
        if (!nft.attribute_synergy || !Array.isArray(nft.attribute_synergy)) {
            return false;
        }
        
        // Проверяем каждую синергию NFT
        for (const synergy of nft.attribute_synergy) {
            if (synergy.rarity) {
                const level = this.convertRarityToLevel(synergy.rarity);
                if (requiredLevels.includes(level)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Проверяет, соответствует ли NFT фильтрам по категориям
    nftMatchesAttributeFilters(nft, attributeFilters) {
        if (!nft.attributes || !Array.isArray(nft.attributes)) {
            return false;
        }
        
        // Создаем карту атрибутов NFT
        const nftAttributeMap = {};
        nft.attributes.forEach(attr => {
            if (attr.trait_type && attr.value) {
                nftAttributeMap[attr.trait_type] = attr.value;
            }
        });
        
        // Проверяем все фильтры
        for (const [category, requiredValues] of Object.entries(attributeFilters)) {
            if (requiredValues.length === 0) continue;
            
            const nftValue = nftAttributeMap[category];
            if (!nftValue || !requiredValues.includes(nftValue)) {
                return false;
            }
        }
        
        return true;
    }
    
    // Проверяет, имеет ли NFT указанные значения атрибутов
    nftHasAttributeValues(nft, attributeValues) {
        if (!nft.attributes || !Array.isArray(nft.attributes)) {
            return false;
        }
        
        const nftValues = new Set();
        nft.attributes.forEach(attr => {
            if (attr.value) {
                nftValues.add(attr.value);
            }
        });
        
        return attributeValues.some(value => nftValues.has(value));
    }
    
    // Рассчитывает редкость NFT на основе его атрибутов
    calculateNftRarity(nft) {
        if (!nft.attributes || !Array.isArray(nft.attributes)) {
            return 'Common';
        }
        
        const rarityPower = this.dataCache.attributesPower?.attributes_power?.rarity_power || {};
        const rarityLevels = Object.keys(rarityPower);
        
        let maxRarity = 'Common';
        let maxPower = rarityPower.Common || 0;
        
        nft.attributes.forEach(attr => {
            const attrRarity = attr.rarity || this.getAttributeRarity(attr.trait_type, attr.value);
            const attrPower = rarityPower[attrRarity] || 0;
            
            if (attrPower > maxPower) {
                maxPower = attrPower;
                maxRarity = attrRarity;
            }
        });
        
        return maxRarity;
    }
    
    // Получает редкость конкретного атрибута
    getAttributeRarity(traitType, value) {
        if (!this.dataCache.attributesPower?.attributes_power?.attributes) {
            return 'Common';
        }
        
        const attributes = this.dataCache.attributesPower.attributes_power.attributes;
        const category = attributes[traitType] || {};
        return category[value] || 'Common';
    }
    
    // Сортируем NFT по количеству синергий и общему power
    sortNFTsBySynergies(nfts) {
        return nfts.sort((a, b) => {
            // Сначала по общему power
            const aPower = a.power_total || 0;
            const bPower = b.power_total || 0;
            
            if (bPower !== aPower) {
                return bPower - aPower;
            }
            
            // Затем по power синергий
            const aSynergyPower = a.synergy_power || 0;
            const bSynergyPower = b.synergy_power || 0;
            
            return bSynergyPower - aSynergyPower;
        });
    }
    
    // Форматируем NFT для отображения на клиенте
    formatNFTsForClient(nfts) {
        return nfts.map(nft => {
            // Находим атрибуты, которые входят в синергии
            const synergyAttributes = this.getSynergyAttributes(nft);
            
            // Добавляем дополнительные поля для отображения
            return {
                ...nft,
                display_name: this.getDisplayName(nft),
                synergy_attributes: synergyAttributes,
                formatted_power: `${nft.power_total || 0} (синергия: ${nft.synergy_power || 0})`
            };
        });
    }
    
    // Получаем атрибуты, которые входят в синергии
    getSynergyAttributes(nft) {
        const synergyAttrs = new Set();
        
        if (nft.attribute_synergy && Array.isArray(nft.attribute_synergy)) {
            nft.attribute_synergy.forEach(synergy => {
                if (synergy.attributes) {
                    // Парсим строку "Ring: Golden Bitcoin, Cap: Gold"
                    const attrPairs = synergy.attributes.split(', ');
                    attrPairs.forEach(pair => {
                        const parts = pair.split(': ');
                        if (parts.length === 2) {
                            synergyAttrs.add(parts[1]); // Значение атрибута
                        }
                    });
                }
            });
        }
        
        return Array.from(synergyAttrs);
    }
    
    // Генерируем отображаемое имя с power
    getDisplayName(nft) {
        const baseName = nft.name || `NFT #${nft.index || 'Unknown'}`;
        const powerTotal = nft.power_total || 0;
        const synergyPower = nft.synergy_power || 0;
        
        return `${baseName} (Power: ${powerTotal} ⚡${synergyPower})`;
    }
    
    // Быстрый поиск по индексу
    searchNFTsFast(query) {
        if (!query || !this.dataCache.nftIndex) {
            return this.dataCache.nfts || [];
        }
        
        const queryLower = query.toLowerCase().trim();
        const results = new Set();
        
        // Поиск по полному имени
        const nameMatch = this.dataCache.nftIndex.get(`name:${queryLower}`);
        if (nameMatch !== undefined) {
            results.add(nameMatch);
        }
        
        // Поиск по частям имени
        const namePartMatch = this.dataCache.nftIndex.get(`name_part:${queryLower}`);
        if (namePartMatch && Array.isArray(namePartMatch)) {
            namePartMatch.forEach(index => results.add(index));
        }
        
        // Поиск по атрибутам
        const attrMatch = this.dataCache.nftIndex.get(`attr:${queryLower}`);
        if (attrMatch && Array.isArray(attrMatch)) {
            attrMatch.forEach(index => results.add(index));
        }
        
        // Поиск по индексу
        if (!isNaN(queryLower)) {
            const indexMatch = this.dataCache.nftIndex.get(`index:${parseInt(queryLower)}`);
            if (indexMatch !== undefined) {
                results.add(indexMatch);
            }
        }
        
        // Получаем NFT по индексам
        return Array.from(results).map(index => this.dataCache.nfts[index]).filter(nft => nft);
    }
}

module.exports = new SortService();