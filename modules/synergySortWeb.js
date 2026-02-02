
const fs = require('fs').promises;
const path = require('path');

// Импортируем общие утилиты
const { 
    DATA_DIR,
    ensureDataDir,
    truncateText
} = require('./utils.js');

// Константы путей
const MAIN_DATA_FILE = path.join(DATA_DIR, 'all_nft_info.json');
const ATTRIBUTES_POWER_FILE = path.join(DATA_DIR, 'attributes_power_data.json');
const SYNERGY_STATE_FILE = path.join(DATA_DIR, 'synergy_state.json');
const USER_STATE_FILE = path.join(DATA_DIR, 'synergy_user_state.json');

// ====== ЗАГРУЗКА ДАННЫХ (аналогично synergySort.js) ======

/**
 * Загружает данные о силе и редкости атрибутов
 */
async function loadAttributesPowerData() {
  try {
    console.log(`📁 Загрузка данных атрибутов из: ${ATTRIBUTES_POWER_FILE}`);
    await ensureDataDir();
    
    const data = await fs.readFile(ATTRIBUTES_POWER_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    // Извлекаем данные о Skin Tone
    const skinTones = parsed.attributes_power?.attributes?.["Skin Tone"];
    if (!skinTones) {
      console.error('❌ Не найдены данные Skin Tone в файле атрибутов');
      return { skinTones: [], rarities: [] };
    }
    
    // Преобразуем в массив объектов
    const skinToneList = Object.entries(skinTones).map(([name, rarity]) => ({
      name,
      rarity,
      selected: false
    }));
    
    // Собираем уникальные уровни редкости из всех атрибутов
    const rarityLevels = new Set();
    const attributes = parsed.attributes_power?.attributes || {};
    
    // Проходим по всем атрибутам и собираем уникальные редкости
    for (const attrType in attributes) {
      if (attrType !== "Skin Tone") { // Skin Tone обрабатываем отдельно
        const attrValues = attributes[attrType];
        for (const value in attrValues) {
          rarityLevels.add(attrValues[value]);
        }
      }
    }
    
    // Преобразуем в массив и сортируем по редкости
    const rarityList = Array.from(rarityLevels).sort((a, b) => {
      const rarityOrder = ["Mythical+", "Mythical", "Legendary", "Epic", "Common"];
      const indexA = rarityOrder.indexOf(a);
      const indexB = rarityOrder.indexOf(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }).map(rarity => ({
      name: rarity,
      selected: false
    }));
    
    console.log(`✅ Загружено ${skinToneList.length} вариантов Skin Tone`);
    console.log(`✅ Найдено ${rarityList.length} уровней редкости:`, rarityList.map(r => r.name));
    
    return {
      skinTones: skinToneList,
      rarities: rarityList
    };
    
  } catch (error) {
    console.error('❌ Ошибка загрузки данных атрибутов:', error.message); 
    return { skinTones: [], rarities: [] };
  }
}

/**
 * Загружает карту синергий из файла synergy_state.json
 */
async function loadSynergyMap() {
  try {
    console.log(`📁 Загрузка карты синергий из: ${SYNERGY_STATE_FILE}`);
    await ensureDataDir();
    
    const data = await fs.readFile(SYNERGY_STATE_FILE, 'utf8');
    const synergyData = JSON.parse(data);
    
    console.log(`✅ Загружено ${Object.keys(synergyData).length} синергий`);
    
    return synergyData;
  } catch (error) {
    console.error('❌ Ошибка загрузки карты синергий:', error.message);
    return {};
  }
}

/**
 * Загружает данные NFT из файла
 */
async function loadNftData() {
  try {
    console.log(`📁 Загрузка NFT данных из: ${MAIN_DATA_FILE}`);
    await ensureDataDir();
    
    // Проверяем существует ли файл
    try {
      await fs.access(MAIN_DATA_FILE);
    } catch (err) {
      console.error(`❌ Файл ${MAIN_DATA_FILE} не найден`);
      return { nfts: [] };
    }
    
    const data = await fs.readFile(MAIN_DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    if (!parsed.nfts || !Array.isArray(parsed.nfts)) {
      console.error('❌ Неверный формат файла данных');
      return { nfts: [] };
    }
    
    console.log(`✅ Загружено ${parsed.nfts.length} NFT из файла`);
    return parsed;
    
  } catch (error) {
    console.error('❌ Ошибка загрузки данных NFT:', error.message);
    return { nfts: [] };
  }
}

/**
 * Загружает карту редкостей атрибутов
 */
async function loadRarityMap() {
  try {
    console.log(`📁 Загрузка карты редкостей из: ${ATTRIBUTES_POWER_FILE}`);
    const data = await fs.readFile(ATTRIBUTES_POWER_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    // Создаем карту: значение атрибута -> редкость
    const rarityMap = {};
    const attributes = parsed.attributes_power?.attributes || {};
    
    for (const attrType in attributes) {
      const attrValues = attributes[attrType];
      for (const value in attrValues) {
        const key = value.toLowerCase().trim();
        rarityMap[key] = attrValues[value];
      }
    }
    
    console.log(`✅ Загружена карта редкостей (${Object.keys(rarityMap).length} значений)`);
    return rarityMap;
    
  } catch (error) {
    console.error('❌ Ошибка загрузки карты редкостей:', error.message);
    return {};
  }
}

// ====== ФУНКЦИИ ПОИСКА И СОРТИРОВКИ (аналогично synergySort.js) ======

/**
 * Находит NFT с указанными параметрами (с использованием файла синергий)
 */
async function findNftsWithCriteria(nfts, synergyLevel, selectedSkinTones = [], selectedRarities = []) {
  console.log(`🔍 Поиск NFT с критериями (используя файл синергий):`);
  console.log(`   • Минимальные совпадения: ${synergyLevel}`);
  console.log(`   • Skin Tone выбрано: ${selectedSkinTones.length}`);
  console.log(`   • Редкости выбрано: ${selectedRarities.length}`, selectedRarities.map(r => r.name));
  
  // Загружаем карту редкостей
  const rarityMap = await loadRarityMap();
  
  // Загружаем карту синергий
  const synergyMap = await loadSynergyMap();
  
  // Создаем обратную карту: название атрибута -> массив синергий, в которых он участвует
  const attributeToSynergies = {};
  
  for (const [synergyName, attributes] of Object.entries(synergyMap)) {
    for (const attribute of attributes) {
      if (!attributeToSynergies[attribute]) {
        attributeToSynergies[attribute] = [];
      }
      attributeToSynergies[attribute].push(synergyName);
    }
  }
  
  console.log(`✅ Создана обратная карта синергий: ${Object.keys(attributeToSynergies).length} уникальных атрибутов`);
  
  const results = [];
  let checkedNfts = 0;
  let filteredOutByRarity = 0;
  let hasRarityAttributes = 0;
  
  for (const nft of nfts) {
    checkedNfts++;
    if (checkedNfts % 1000 === 0) {
      console.log(`   Проверено ${checkedNfts}/${nfts.length} NFT`);
    }
    
    if (!nft.attributes || !Array.isArray(nft.attributes)) {
      continue;
    }
    
    // Проверка Skin Tone если есть выбранные
    if (selectedSkinTones.length > 0) {
      const skinToneAttr = nft.attributes.find(attr => 
        attr.trait_type === "Skin Tone"
      );
      
      if (!skinToneAttr) continue;
      
      const hasSelectedSkinTone = selectedSkinTones.some(tone => 
        tone.name === skinToneAttr.value
      );
      
      if (!hasSelectedSkinTone) continue;
    }
    
    // Фильтруем атрибуты по выбранным редкостям
    let filteredAttributes = nft.attributes.filter(attr => 
      attr.trait_type !== "Skin Tone" // Исключаем Skin Tone
    );
    
    // Фильтрация по редкости
    if (selectedRarities.length > 0) {
      const originalCount = filteredAttributes.length;
      filteredAttributes = filteredAttributes.filter(attr => {
        if (!attr.value) return false;
        
        const valueKey = attr.value.toLowerCase().trim();
        let rarity = rarityMap[valueKey];
        
        if (!rarity) return false;
        
        const isSelected = selectedRarities.some(selected => selected.name === rarity);
        return isSelected;
      });
      
      if (originalCount > 0 && filteredAttributes.length === 0) {
        filteredOutByRarity++;
      }
      
      if (filteredAttributes.length > 0) {
        hasRarityAttributes++;
      }
    }
    
    if (filteredAttributes.length === 0) {
      continue;
    }
    
    // Считаем синергии для этого NFT
    const synergyCounts = {};
    const attributeSynergies = {};
    
    // Для каждого атрибута находим синергии
    for (const attr of filteredAttributes) {
      const attributeName = attr.value;
      
      if (attributeToSynergies[attributeName]) {
        // Атрибут участвует в синергиях
        attributeSynergies[attributeName] = attributeToSynergies[attributeName];
        
        // Увеличиваем счетчики для каждой синергии
        for (const synergyName of attributeToSynergies[attributeName]) {
          if (!synergyCounts[synergyName]) {
            synergyCounts[synergyName] = {
              count: 0,
              attributes: [],
              synergyName: synergyName
            };
          }
          synergyCounts[synergyName].count++;
          synergyCounts[synergyName].attributes.push({
            attribute: attributeName,
            trait_type: attr.trait_type
          });
        }
      }
    }
    
    // Находим синергии с максимальным количеством совпадений
    let maxSynergy = null;
    let maxCount = 0;
    
    for (const [synergyName, data] of Object.entries(synergyCounts)) {
      if (data.count > maxCount) {
        maxCount = data.count;
        maxSynergy = data;
      }
    }
    
    // Проверяем соответствует ли уровень синергии
    const meetsCriteria = (synergyLevel === 2 && maxCount >= 2) || 
                          (synergyLevel === 3 && maxCount >= 3);
    
    if (meetsCriteria && maxSynergy) {
      // Находим Skin Tone для отображения
      const skinToneAttr = nft.attributes.find(attr => 
        attr.trait_type === "Skin Tone"
      );
      
      // Находим редкости атрибутов в синергии
      const synergyRarities = [];
      for (const attrData of maxSynergy.attributes) {
        const attrKey = attrData.attribute.toLowerCase().trim();
        if (rarityMap[attrKey]) {
          synergyRarities.push(rarityMap[attrKey]);
        }
      }
      
      // Определяем основную редкость (самая частая)
      const rarityCounts = {};
      let mainRarity = "Неизвестно";
      let maxRarityCount = 0;
      
      for (const rarity of synergyRarities) {
        rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1;
        if (rarityCounts[rarity] > maxRarityCount) {
          maxRarityCount = rarityCounts[rarity];
          mainRarity = rarity;
        }
      }
      
      results.push({
        nft: nft,
        synergyScore: maxCount,
        skinTone: skinToneAttr ? skinToneAttr.value : "Не указан",
        matchingSynergies: [maxSynergy],
        totalAttributes: nft.attributes.length,
        filteredAttributesCount: filteredAttributes.length,
        meetsRarityFilter: selectedRarities.length > 0,
        rarity: mainRarity,
        allSynergies: synergyCounts
      });
    }
  }
  
  // Сортируем по количеству совпадений (по убыванию)
  results.sort((a, b) => b.synergyScore - a.synergyScore);
  
  console.log(`✅ Найдено ${results.length} NFT, соответствующих критериям`);
  console.log(`   Проверено всего: ${checkedNfts} NFT`);
  console.log(`   Отфильтровано по редкости: ${filteredOutByRarity} NFT`);
  console.log(`   NFT с подходящими атрибутами: ${hasRarityAttributes}`);
  
  // Статистика результатов
  if (results.length > 0) {
    const synergy2Count = results.filter(r => r.synergyScore === 2).length;
    const synergy3Count = results.filter(r => r.synergyScore === 3).length;
    const synergy4PlusCount = results.filter(r => r.synergyScore >= 4).length;
    
    console.log(`📊 Распределение по синергии:`);
    console.log(`   • 2 совпадения: ${synergy2Count} NFT`);
    console.log(`   • 3 совпадения: ${synergy3Count} NFT`);
    console.log(`   • 4+ совпадений: ${synergy4PlusCount} NFT`);
    
    // Распределение по редкости
    const rarityStats = {};
    results.forEach(result => {
      const rarity = result.rarity;
      rarityStats[rarity] = (rarityStats[rarity] || 0) + 1;
    });
    
    console.log(`📊 Распределение по редкости совпадений:`);
    Object.entries(rarityStats).forEach(([rarity, count]) => {
      console.log(`   • ${rarity}: ${count} NFT`);
    });
    
    // Статистика по синергиям
    const synergyStats = {};
    results.forEach(result => {
      if (result.matchingSynergies && result.matchingSynergies.length > 0) {
        const synergyName = result.matchingSynergies[0].synergyName;
        synergyStats[synergyName] = (synergyStats[synergyName] || 0) + 1;
      }
    });
    
    console.log(`📊 Распределение по синергиям (топ-5):`);
    Object.entries(synergyStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([synergy, count], index) => {
        console.log(`   ${index+1}. ${synergy}: ${count} NFT`);
      });
  } else {
    console.log(`❌ Не найдено NFT с выбранными критериями`);
  }
  
  return results;
}

// ====== ВЕБ-ИНТЕРФЕЙС ФУНКЦИИ ======

/**
 * Получить данные для интерфейса сортировки (веб-версия)
 */
async function getSortData() {
    try {
        await ensureDataDir();
        
        // Загружаем данные атрибутов
        const attributesData = await loadAttributesPowerData();
        const skinTones = attributesData.skinTones || [];
        const rarities = attributesData.rarities || [];
        
        // Загружаем карту синергий
        const synergyMap = await loadSynergyMap();
        
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
                synergyCount: Object.keys(synergyMap).length,
                synergyList: Object.keys(synergyMap).slice(0, 10) // Первые 10 синергий для примера
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
 * Выполнить сортировку с заданными параметрами (веб-версия)
 */
async function executeSort(params) {
    try {
        const {
            synergyLevel = 2,
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
        
        // Преобразуем выбранные значения в объекты для findNftsWithCriteria
        const selectedSkinObjects = selectedSkinTones.map(name => ({
            name,
            selected: true
        }));
        
        const selectedRarityObjects = selectedRarities.map(name => ({
            name,
            selected: true
        }));
        
        // Выполняем поиск (используем ту же функцию что и в synergySort.js)
        const results = await findNftsWithCriteria(
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
                totalAttributes: result.totalAttributes,
                filteredAttributesCount: result.filteredAttributesCount
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
            synergyDistributionByType: {},
            topSynergies: []
        };
        
        // Распределение по редкостям
        results.forEach(result => {
            const rarity = result.rarity || 'Неизвестно';
            stats.rarityDistribution[rarity] = (stats.rarityDistribution[rarity] || 0) + 1;
        });
        
        // Распределение по типам синергий
        const synergyStats = {};
        results.forEach(result => {
            if (result.matchingSynergies && result.matchingSynergies.length > 0) {
                const synergyName = result.matchingSynergies[0].synergyName;
                synergyStats[synergyName] = (synergyStats[synergyName] || 0) + 1;
            }
        });
        
        // Топ синергий
        stats.topSynergies = Object.entries(synergyStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
        
        Object.assign(stats.synergyDistributionByType, synergyStats);
        
        return {
            success: true,
            results: formattedResults,
            totalResults: formattedResults.length,
            searchParams,
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
        return {
            success: false,
            error: error.message,
            results: [],
            totalResults: 0,
            stats: {}
        };
    }
}

/**
 * Получить детали конкретного NFT (веб-версия)
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
        const rarityMap = await loadRarityMap();
        
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
            success: true,
            nft: {
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
            }
        };
        
    } catch (error) {
        console.error('Ошибка получения деталей NFT:', error);
        return {
            success: false,
            error: error.message,
            nft: null
        };
    }
}

/**
 * Получить статистику системы (веб-версия)
 */
async function getStats() {
    try {
        // Загружаем данные NFT
        const nftData = await loadNftData();
        const nfts = nftData.nfts || [];
        
        // Загружаем данные атрибутов
        const attributesData = await loadAttributesPowerData();
        const skinTones = attributesData.skinTones || [];
        const rarities = attributesData.rarities || [];
        
        // Загружаем карту синергий
        const synergyMap = await loadSynergyMap();
        
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
        
        // Топ синергий по количеству атрибутов
        const topSynergiesBySize = Object.entries(synergyMap)
            .map(([name, attributes]) => ({
                name,
                attributeCount: attributes.length,
                attributes: attributes.slice(0, 5) // Первые 5 атрибутов
            }))
            .sort((a, b) => b.attributeCount - a.attributeCount)
            .slice(0, 10);
        
        return {
            success: true,
            stats: {
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
                    distribution: attributeStats.skinToneDistribution,
                    topSkinTones: Object.entries(attributeStats.skinToneDistribution)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([name, count]) => ({ name, count }))
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
                    sizeDistribution: synergyStats.synergySizeDistribution,
                    topSynergiesBySize: topSynergiesBySize
                },
                lastUpdated: nftData.collection_info?.last_updated || new Date().toISOString()
            }
        };
        
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        return {
            success: false,
            error: error.message,
            stats: null
        };
    }
}

/**
 * Получить примеры синергий для демонстрации
 */
async function getSynergyExamples() {
    try {
        const synergyMap = await loadSynergyMap();
        
        // Берем 5 случайных синергий для демонстрации
        const synergyNames = Object.keys(synergyMap);
        const examples = [];
        
        // Всегда включаем Gold и Cosmic как хорошие примеры
        const importantSynergies = ['Gold', 'Cosmic', 'Spiked', 'TON', 'Magic'];
        
        importantSynergies.forEach(name => {
            if (synergyMap[name]) {
                examples.push({
                    name,
                    attributes: synergyMap[name],
                    count: synergyMap[name].length
                });
            }
        });
        
        // Добавляем еще случайных до 10 примеров
        const otherSynergies = synergyNames
            .filter(name => !importantSynergies.includes(name))
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
        
        otherSynergies.forEach(name => {
            examples.push({
                name,
                attributes: synergyMap[name],
                count: synergyMap[name].length
            });
        });
        
        // Пример как работает поиск
        const howItWorksExample = {
            synergyName: "Gold",
            attributes: ["Gold", "Gold Braid", "Spiked Gold", "Gold Rope"],
            description: "Если NFT имеет атрибуты 'Gold', 'Gold Braid' и 'Spiked Gold', это считается 3 совпадениями по синергии 'Gold'"
        };
        
        return {
            success: true,
            examples,
            howItWorks: howItWorksExample,
            totalSynergies: synergyNames.length
        };
        
    } catch (error) {
        console.error('Ошибка получения примеров синергий:', error);
        return {
            success: false,
            error: error.message,
            examples: []
        };
    }
}

// ====== ЭКСПОРТ ======
module.exports = {
    // Основные функции для веб-интерфейса
    getSortData,
    executeSort,
    getNftDetails,
    getStats,
    getSynergyExamples,
    
    // Вспомогательные функции (могут пригодиться)
    loadAttributesPowerData,
    loadSynergyMap,
    loadNftData,
    loadRarityMap,
    findNftsWithCriteria
};