const fs = require('fs').promises;
const path = require('path');

// Импортируем общие утилиты
const { 
    DATA_DIR,
    ensureDataDir,
    truncateText
} = require('./utils.js');

// Импортируем основные функции из synergySort.js (адаптируем для веба)
const synergySortModule = require('./synergySort.js');

// Константы путей
const MAIN_DATA_FILE = path.join(DATA_DIR, 'all_nft_info.json');
const ATTRIBUTES_POWER_FILE = path.join(DATA_DIR, 'attributes_power_data.json');
const SYNERGY_STATE_FILE = path.join(DATA_DIR, 'synergy_state.json');
const USER_STATE_FILE = path.join(DATA_DIR, 'synergy_user_state.json');

// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======

/**
 * Получить данные для интерфейса сортировки
 */
async function getSortData() {
    try {
        await ensureDataDir();
        
        // Загружаем данные атрибутов
        const attributesData = await synergySortModule.loadAttributesPowerData();
        const skinTones = attributesData.skinTones || [];
        const rarities = attributesData.rarities || [];
        
        // Загружаем карту синергий
        const synergyMap = await synergySortModule.loadSynergyMap();
        
        // Загружаем данные NFT (только для статистики)
        const nftData = await loadNftData();
        
        return {
            skinTones: skinTones.map(tone => ({
                name: tone.name,
                rarity: tone.rarity,
                selected: false
            })),
            rarities: rarities.map(rarity => ({
                name: rarity.name,
                selected: false
            })),
            synergyOptions: [2, 3],
            stats: {
                totalNfts: nftData.nfts?.length || 0,
                skinToneCount: skinTones.length,
                rarityCount: rarities.length,
                synergyCount: Object.keys(synergyMap).length
            },
            defaultFilterOptions: {
                allNfts: true,
                onSaleOnly: false
            }
        };
        
    } catch (error) {
        console.error('Ошибка получения данных сортировки:', error);
        throw error;
    }
}

/**
 * Выполнить сортировку с заданными параметрами
 */
async function executeSort(params) {
    try {
        const {
            synergyLevel,
            selectedSkinTones = [],
            selectedRarities = [],
            filterOptions = {
                allNfts: true,
                onSaleOnly: false
            },
            userId = 'web_user',
            username = 'web_user'
        } = params;
        
        console.log('🎯 Выполнение сортировки с параметрами:', {
            synergyLevel,
            selectedSkinTonesCount: selectedSkinTones.length,
            selectedRaritiesCount: selectedRarities.length,
            filterOptions,
            userId
        });
        
        // Загружаем данные NFT
        const nftData = await loadNftData();
        const nfts = nftData.nfts || [];
        
        if (nfts.length === 0) {
            throw new Error('База данных NFT пуста');
        }
        
        // Загружаем данные атрибутов
        const attributesData = await synergySortModule.loadAttributesPowerData();
        const skinTones = attributesData.skinTones || [];
        const rarities = attributesData.rarities || [];
        
        // Преобразуем выбранные значения в объекты для synergySort
        const selectedSkinObjects = selectedSkinTones.map(name => ({
            name,
            selected: true
        }));
        
        const selectedRarityObjects = selectedRarities.map(name => ({
            name,
            selected: true
        }));
        
        // Выполняем поиск
        const results = await synergySortModule.findNftsWithCriteria(
            nfts,
            synergyLevel,
            selectedSkinObjects,
            selectedRarityObjects
        );
        
        // Подготавливаем параметры поиска
        const searchParams = {
            synergyLevel,
            selectedSkinTones,
            selectedRarities,
            searchDate: new Date().toISOString(),
            totalNfts: nfts.length,
            foundNfts: results.length
        };
        
        // Сохраняем результаты
        const saveResult = await synergySortModule.saveFilteredNfts(
            userId,
            username,
            results,
            searchParams,
            filterOptions
        );
        
        // Форматируем результаты для веб-интерфейса
        const formattedResults = results.map((result, index) => {
            const nft = result.nft;
            return {
                index: index,
                nftIndex: nft.index || index,
                name: nft.name || `NFT #${nft.index || index}`,
                synergyScore: result.synergyScore,
                skinTone: result.skinTone,
                rarity: result.rarity,
                matchingSynergies: result.matchingSynergies,
                attributes: nft.attributes || [],
                imageUrl: nft.image_url,
                address: nft.address,
                onSale: nft.on_sale,
                salePrice: nft.sale_price
            };
        });
        
        // Статистика результатов
        const stats = {
            totalFound: results.length,
            synergyDistribution: {
                level2: results.filter(r => r.synergyScore === 2).length,
                level3: results.filter(r => r.synergyScore === 3).length,
                level4plus: results.filter(r => r.synergyScore >= 4).length
            },
            rarityDistribution: {},
            synergyDistributionByType: {}
        };
        
        // Распределение по редкостям
        results.forEach(result => {
            const rarity = result.rarity || 'Неизвестно';
            stats.rarityDistribution[rarity] = (stats.rarityDistribution[rarity] || 0) + 1;
        });
        
        // Распределение по типам синергий
        results.forEach(result => {
            if (result.matchingSynergies && result.matchingSynergies.length > 0) {
                const synergyName = result.matchingSynergies[0].synergyName;
                stats.synergyDistributionByType[synergyName] = 
                    (stats.synergyDistributionByType[synergyName] || 0) + 1;
            }
        });
        
        return {
            results: formattedResults.slice(0, 100), // Ограничиваем для веба
            totalResults: formattedResults.length,
            searchParams,
            saveResult,
            stats,
            summary: {
                message: `Найдено ${formattedResults.length} NFT с ${synergyLevel}+ совпадениями`,
                parameters: {
                    synergyLevel,
                    selectedSkinTones,
                    selectedRarities,
                    filterOptions
                }
            }
        };
        
    } catch (error) {
        console.error('Ошибка выполнения сортировки:', error);
        throw error;
    }
}

/**
 * Получить результаты пользователя
 */
async function getUserResults(userId) {
    try {
        // Пробуем загрузить основной файл
        const mainFile = await synergySortModule.loadFilteredNfts(userId, 'web_user', false);
        
        // Пробуем загрузить файл с NFT на продаже
        const onSaleFile = await synergySortModule.loadFilteredNfts(userId, 'web_user', true);
        
        const results = {};
        
        if (mainFile.success) {
            results.mainFile = {
                exists: true,
                data: mainFile.data,
                fileName: mainFile.fileName,
                nftsCount: mainFile.data.nfts?.length || 0
            };
        } else {
            results.mainFile = { exists: false };
        }
        
        if (onSaleFile.success) {
            results.onSaleFile = {
                exists: true,
                data: onSaleFile.data,
                fileName: onSaleFile.fileName,
                nftsCount: onSaleFile.data.nfts?.length || 0
            };
        } else {
            results.onSaleFile = { exists: false };
        }
        
        return results;
        
    } catch (error) {
        console.error('Ошибка получения результатов пользователя:', error);
        throw error;
    }
}

/**
 * Удалить результаты пользователя
 */
async function deleteUserResults(userId, fileType) {
    try {
        let result;
        
        if (fileType === 'all') {
            // Удаляем оба файла
            const mainResult = await synergySortModule.deleteFilteredNfts(userId, 'web_user', false);
            const onSaleResult = await synergySortModule.deleteFilteredNfts(userId, 'web_user', true);
            
            result = {
                mainFile: mainResult.success ? 'удален' : 'не найден',
                onSaleFile: onSaleResult.success ? 'удален' : 'не найден'
            };
        } else if (fileType === 'onsale') {
            // Удаляем только файл с NFT на продаже
            result = await synergySortModule.deleteFilteredNfts(userId, 'web_user', true);
        } else {
            // Удаляем основной файл
            result = await synergySortModule.deleteFilteredNfts(userId, 'web_user', false);
        }
        
        return result;
        
    } catch (error) {
        console.error('Ошибка удаления результатов:', error);
        throw error;
    }
}

/**
 * Получить статистику
 */
async function getStats() {
    try {
        // Загружаем данные NFT
        const nftData = await loadNftData();
        const nfts = nftData.nfts || [];
        
        // Загружаем данные атрибутов
        const attributesData = await synergySortModule.loadAttributesPowerData();
        const skinTones = attributesData.skinTones || [];
        const rarities = attributesData.rarities || [];
        
        // Загружаем карту синергий
        const synergyMap = await synergySortModule.loadSynergyMap();
        
        // Анализируем атрибуты NFT
        const attributeStats = {
            totalNfts: nfts.length,
            nftsWithAttributes: 0,
            attributesPerNft: [],
            uniqueAttributes: new Set(),
            skinToneDistribution: {}
        };
        
        // Считаем статистику по Skin Tone
        nfts.forEach(nft => {
            if (nft.attributes && Array.isArray(nft.attributes)) {
                attributeStats.nftsWithAttributes++;
                attributeStats.attributesPerNft.push(nft.attributes.length);
                
                // Собираем уникальные атрибуты
                nft.attributes.forEach(attr => {
                    if (attr.value) {
                        attributeStats.uniqueAttributes.add(attr.value);
                    }
                });
                
                // Считаем распределение по Skin Tone
                const skinToneAttr = nft.attributes.find(a => a.trait_type === 'Skin Tone');
                if (skinToneAttr && skinToneAttr.value) {
                    const skinTone = skinToneAttr.value;
                    attributeStats.skinToneDistribution[skinTone] = 
                        (attributeStats.skinToneDistribution[skinTone] || 0) + 1;
                }
            }
        });
        
        // Статистика синергий
        const synergyStats = {
            totalSynergies: Object.keys(synergyMap).length,
            attributesInSynergies: 0,
            uniqueSynergyAttributes: new Set(),
            synergySizeDistribution: {}
        };
        
        Object.values(synergyMap).forEach(attributes => {
            synergyStats.attributesInSynergies += attributes.length;
            attributes.forEach(attr => {
                synergyStats.uniqueSynergyAttributes.add(attr);
            });
            
            const size = attributes.length;
            synergyStats.synergySizeDistribution[size] = 
                (synergyStats.synergySizeDistribution[size] || 0) + 1;
        });
        
        return {
            nfts: {
                total: attributeStats.totalNfts,
                withAttributes: attributeStats.nftsWithAttributes,
                avgAttributesPerNft: attributeStats.attributesPerNft.length > 0 
                    ? (attributeStats.attributesPerNft.reduce((a, b) => a + b, 0) / attributeStats.attributesPerNft.length).toFixed(2)
                    : 0,
                uniqueAttributesCount: attributeStats.uniqueAttributes.size
            },
            skinTones: {
                total: skinTones.length,
                distribution: attributeStats.skinToneDistribution
            },
            rarities: {
                total: rarities.length,
                list: rarities.map(r => r.name)
            },
            synergies: {
                total: synergyStats.totalSynergies,
                totalAttributes: synergyStats.attributesInSynergies,
                uniqueAttributes: synergyStats.uniqueSynergyAttributes.size,
                avgAttributesPerSynergy: (synergyStats.attributesInSynergies / synergyStats.totalSynergies).toFixed(2),
                sizeDistribution: synergyStats.synergySizeDistribution
            },
            lastUpdated: nftData.collection_info?.last_updated || new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        throw error;
    }
}

/**
 * Получить детали конкретного NFT
 */
async function getNftDetails(indexOrAddress) {
    try {
        const nftData = await loadNftData();
        const nfts = nftData.nfts || [];
        
        let nft;
        
        // Поиск по индексу
        if (typeof indexOrAddress === 'number') {
            nft = nfts.find(n => n.index === indexOrAddress);
        } 
        // Поиск по адресу (частичному совпадению)
        else if (typeof indexOrAddress === 'string') {
            nft = nfts.find(n => 
                n.address && n.address.includes(indexOrAddress) ||
                n.user_friendly_address && n.user_friendly_address.includes(indexOrAddress)
            );
        }
        
        if (!nft) {
            throw new Error('NFT не найден');
        }
        
        // Загружаем карту редкостей
        const rarityMap = await synergySortModule.loadRarityMap();
        
        // Добавляем информацию о редкости атрибутов
        const enhancedAttributes = (nft.attributes || []).map(attr => {
            const rarity = rarityMap[attr.value?.toLowerCase().trim()] || 'Неизвестно';
            return {
                ...attr,
                rarity
            };
        });
        
        // Форматируем для отображения
        return {
            ...nft,
            attributes: enhancedAttributes,
            formatted: {
                name: nft.name || `NFT #${nft.index}`,
                imageUrl: nft.image_url || '',
                owner: nft.owner_address ? truncateText(nft.owner_address, 20) : 'Неизвестно',
                userFriendlyAddress: nft.user_friendly_address || '',
                getgemsLink: nft.getgems_url || '',
                ownerLink: nft.owner_url || ''
            }
        };
        
    } catch (error) {
        console.error('Ошибка получения деталей NFT:', error);
        throw error;
    }
}

/**
 * Загрузить данные NFT (обертка для веба)
 */
async function loadNftData() {
    try {
        await ensureDataDir();
        
        const data = await fs.readFile(MAIN_DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        return parsed;
        
    } catch (error) {
        console.error('Ошибка загрузки данных NFT:', error);
        return { nfts: [] };
    }
}

// ====== ЭКСПОРТ ======
module.exports = {
    getSortData,
    executeSort,
    getUserResults,
    deleteUserResults,
    getStats,
    getNftDetails,
    loadNftData
};