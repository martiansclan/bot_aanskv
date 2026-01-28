const { 
  DATA_DIR,
  ensureDataDir,
  escapeMarkdown,
  truncateText
} = require('./utils.js');
const fs = require('fs').promises;
const path = require('path');

// Импорт функций для проверки продажи NFT
const { 
  checkNftOnSale,
  filterNftsOnSale,
  filterAndSaveOnSaleNfts,
  API_CONFIG 
} = require('./checkNftOnSale.js');

// ====== КОНСТАНТЫ И КОНФИГУРАЦИЯ ======

const MAIN_DATA_FILE = path.join(DATA_DIR, 'all_nft_info.json');
const ATTRIBUTES_POWER_FILE = path.join(DATA_DIR, 'attributes_power_data.json');
const SYNERGY_STATE_FILE = path.join(DATA_DIR, 'synergy_state.json');

// Минимальные совпадения для синергии
const SYNERGY_OPTIONS = [2, 3];

// ====== ЗАГРУЗКА ДАННЫХ ======

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

/**
 * Загружает состояние сортировки для конкретного пользователя
 */
async function loadSynergyState(userId) {
  try {
    const filePath = path.join(DATA_DIR, 'synergy_user_state.json');
    const data = await fs.readFile(filePath, 'utf8');
    const allStates = JSON.parse(data);
    return allStates[userId] || getDefaultState();
  } catch (error) {
    // Возвращаем состояние по умолчанию
    return getDefaultState();
  }
}

/**
 * Сохраняет состояние сортировки для конкретного пользователя
 */
async function saveSynergyState(userId, state) {
  try {
    const filePath = path.join(DATA_DIR, 'synergy_user_state.json');
    let allStates = {};
    try {
      const data = await fs.readFile(filePath, 'utf8');
      allStates = JSON.parse(data);
    } catch (error) {
      // Файл не существует, создаем новый
      allStates = {};
    }
    
    allStates[userId] = state;
    
    await fs.writeFile(
      filePath,
      JSON.stringify(allStates, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('❌ Ошибка сохранения состояния:', error.message);
  }
}

/**
 * Возвращает состояние по умолчанию
 */
function getDefaultState() {
  return {
    synergyLevel: 2,
    selectedSkinTones: [],
    selectedRarities: [],
    filterOptions: {
      allNfts: true,        // Чекбокс "Все" по умолчанию включен
      onSaleOnly: false     // Чекбокс "На продаже" по умолчанию выключен
    },
    lastSearch: null,
    lastResultsCount: 0,
    lastResults: [], // Сохраняем последние результаты для пользователя
    lastSearchParams: null // Сохраняем параметры последнего поиска
  };
}

/**
 * Сохраняет отфильтрованные NFT в файл для конкретного пользователя
 */
async function saveFilteredNfts(userId, username, results, searchParams, filterOptions) {
  try {
    await ensureDataDir();
    
    console.log(`💾 Начало сохранения фильтрованных NFT`);
    console.log(`   • Фильтр "Все NFT": ${filterOptions.allNfts}`);
    console.log(`   • Фильтр "На продаже": ${filterOptions.onSaleOnly}`);

    // Создаем директорию для файлов пользователей, если ее нет
    const userFilesDir = path.join(DATA_DIR, 'user_files');
    try {
      await fs.mkdir(userFilesDir, { recursive: true });
    } catch (error) {
      // Директория уже существует
    }
    
    // Создаем безопасное имя файла из username
    const safeUsername = (username || `user_${userId}`)
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .substring(0, 50);
    
    // Имя основного файла
    const fileName = `Orc_filtered_${safeUsername}_${userId}.json`;
    const filePath = path.join(userFilesDir, fileName);
    
    // Подготавливаем данные для сохранения
    const nftsData = results.map(result => {
      // Извлекаем сырые данные NFT
      const nft = result.nft;
      
      // Добавляем информацию о синергии
      return {
        ...nft,
        synergyInfo: {
          synergyScore: result.synergyScore,
          skinTone: result.skinTone,
          matchingSynergies: result.matchingSynergies,
          filteredAttributesCount: result.filteredAttributesCount,
          rarity: result.rarity,
          searchParams: searchParams // Сохраняем параметры поиска
        }
      };
    });
    
    // Создаем полный объект с метаданными
    const saveData = {
      metadata: {
        userId: userId,
        username: username || `user_${userId}`,
        fileName: fileName,
        savedAt: new Date().toISOString(),
        searchParams: searchParams,
        filterOptions: filterOptions,
        nftsCount: nftsData.length,
        originalResultsCount: results.length
      },
      nfts: nftsData
    };
    
    // Сохраняем основной файл
    await fs.writeFile(
      filePath,
      JSON.stringify(saveData, null, 2),
      'utf8'
    );
    
    console.log(`✅ Сохранено ${nftsData.length} NFT в основной файл: ${fileName}`);
    
    let onSaleFileResult = null;
    
    // Если выбран чекбокс "На продаже", проверяем NFT через отдельный модуль
    if (filterOptions.onSaleOnly) {
      console.log(`🔍 Чекбокс "На продаже" выбран, проверяю NFT через модуль...`);
      
      if (nftsData.length > 0) {
        // Используем функцию из checkNftOnSale.js для проверки и сохранения NFT на продаже
        const filterParams = {
          synergyLevel: searchParams.synergyLevel,
          selectedSkinTones: searchParams.selectedSkinTones,
          selectedRarities: searchParams.selectedRarities,
          searchType: 'synergy_sort'
        };
        
        const onSaleResult = await filterAndSaveOnSaleNfts(
          nftsData, 
          username, 
          userId, 
          filterParams
        );
        
        if (onSaleResult.success) {
          console.log(`✅ Проверка NFT на продаже завершена`);
          
          onSaleFileResult = {
            success: true,
            nftsCount: onSaleResult.nfts?.length || 0,
            stats: onSaleResult.stats,
            saveResult: onSaleResult.saveResult,
            message: `Найдено ${onSaleResult.nfts?.length || 0} NFT на продаже`
          };
        } else {
          console.log(`❌ Ошибка при проверке NFT на продаже:`, onSaleResult.error);
          
          onSaleFileResult = {
            success: false,
            message: onSaleResult.error || 'Ошибка проверки',
            error: onSaleResult.error
          };
        }
      } else {
        console.log(`ℹ️ Нет NFT для проверки на продажу`);
        onSaleFileResult = {
          success: false,
          message: 'Нет NFT для проверки'
        };
      }
    }
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName,
      nftsCount: nftsData.length,
      onSaleFile: onSaleFileResult
    };
    
  } catch (error) {
    console.error('❌ Ошибка сохранения отфильтрованных NFT:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Загружает отфильтрованные NFT пользователя
 */
async function loadFilteredNfts(userId, username, onSaleOnly = false) {
  try {
    const userFilesDir = path.join(DATA_DIR, 'user_files');
    
    // Создаем безопасное имя файла
    const safeUsername = (username || `user_${userId}`)
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .substring(0, 50);
    
    // Выбираем имя файла в зависимости от типа
    let fileName;
    if (onSaleOnly) {
      fileName = `Orc_filtered_onsale_${safeUsername}_${userId}.json`;
    } else {
      fileName = `Orc_filtered_${safeUsername}_${userId}.json`;
    }
    
    const filePath = path.join(userFilesDir, fileName);
    
    // Проверяем существует ли файл
    try {
      await fs.access(filePath);
    } catch (error) {
      console.log(`📭 Файл не найден: ${fileName}`);
      return { 
        success: false, 
        error: 'Файл не найден',
        fileName: fileName
      };
    }
    
    // Загружаем данные
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    
    console.log(`✅ Загружено ${parsed.nfts?.length || 0} NFT из файла: ${fileName}`);
    
    return {
      success: true,
      data: parsed,
      filePath: filePath,
      fileName: fileName
    };
    
  } catch (error) {
    console.error('❌ Ошибка загрузки отфильтрованных NFT:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Удаляет файл отфильтрованных NFT пользователя
 */
async function deleteFilteredNfts(userId, username, onSaleOnly = false) {
  try {
    const userFilesDir = path.join(DATA_DIR, 'user_files');
    
    const safeUsername = (username || `user_${userId}`)
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .substring(0, 50);
    
    // Выбираем имя файла в зависимости от типа
    let fileName;
    if (onSaleOnly) {
      fileName = `Orc_filtered_onsale_${safeUsername}_${userId}.json`;
    } else {
      fileName = `Orc_filtered_${safeUsername}_${userId}.json`;
    }
    
    const filePath = path.join(userFilesDir, fileName);
    
    // Проверяем существует ли файл
    try {
      await fs.access(filePath);
    } catch (error) {
      return { 
        success: false, 
        error: 'Файл не найден',
        fileName: fileName
      };
    }
    
    // Удаляем файл
    await fs.unlink(filePath);
    
    console.log(`🗑️ Удален файл: ${fileName}`);
    
    return {
      success: true,
      fileName: fileName
    };
    
  } catch (error) {
    console.error('❌ Ошибка удаления файла NFT:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ====== ФУНКЦИИ ДЛЯ СОЗДАНИЯ ИНТЕРФЕЙСА ======

/**
 * Создает клавиатуру с выбором параметров
 */
function createSelectionKeyboard(synergyLevel, skinTones, rarities, filterOptions = null, page = 0, rarityPage = 0) {
  const SKIN_TONES_PER_PAGE = 8;
  const RARITIES_PER_PAGE = 5;
  
  const skinStartIndex = page * SKIN_TONES_PER_PAGE;
  const skinEndIndex = skinStartIndex + SKIN_TONES_PER_PAGE;
  const currentSkinTones = skinTones.slice(skinStartIndex, skinEndIndex);
  
  const rarityStartIndex = rarityPage * RARITIES_PER_PAGE;
  const rarityEndIndex = rarityStartIndex + RARITIES_PER_PAGE;
  const currentRarities = rarities.slice(rarityStartIndex, rarityEndIndex);
  
  const inlineKeyboard = [];
  
  // Секция 1: Выбор синергии
  inlineKeyboard.push([
    {
      text: synergyLevel === 2 ? "✅ 2+ совпадения" : "2+ совпадения",
      callback_data: "synergy_select_2"
    },
    {
      text: synergyLevel === 3 ? "✅ 3+ совпадения" : "3+ совпадения",
      callback_data: "synergy_select_3"
    }
  ]);
  
  // Секция 2: Фильтры "Все" и "На продаже"
  // Используем значения по умолчанию если filterOptions не передан
  const safeFilterOptions = filterOptions || {
    allNfts: true,
    onSaleOnly: false
  };
  
  inlineKeyboard.push([
    {
      text: safeFilterOptions.allNfts ? "✅ Все NFT" : "⬜ Все NFT",
      callback_data: "filter_all"
    },
    {
      text: safeFilterOptions.onSaleOnly ? "✅ На продаже" : "⬜ На продаже",
      callback_data: "filter_on_sale"
    }
  ]);
  
  // Секция 3: Выбор Skin Tone
  inlineKeyboard.push([{ text: "🎨 Секция: Skin Tone", callback_data: "skin_section" }]);
  
  // Кнопки для Skin Tone (по 2 в строку)
  for (let i = 0; i < currentSkinTones.length; i += 2) {
    const row = [];
    
    for (let j = 0; j < 2; j++) {
      if (i + j < currentSkinTones.length) {
        const tone = currentSkinTones[i + j];
        const icon = tone.selected ? "✅" : "⬜";
        const buttonText = `${icon} ${tone.name}`;
        
        row.push({
          text: buttonText,
          callback_data: `skin_toggle_${tone.name}_${page}`
        });
      }
    }
    
    if (row.length > 0) {
      inlineKeyboard.push(row);
    }
  }
  
  // Кнопки навигации для Skin Tone
  const skinNavRow = [];
  if (page > 0) {
    skinNavRow.push({
      text: "⬅️ Skin",
      callback_data: `skin_page_${page - 1}`
    });
  }
  
  if (skinEndIndex < skinTones.length) {
    skinNavRow.push({
      text: "Skin ➡️",
      callback_data: `skin_page_${page + 1}`
    });
  }
  
  if (skinNavRow.length > 0) {
    inlineKeyboard.push(skinNavRow);
  }
  
  // Кнопки выбора всех/очистки для Skin Tone
  inlineKeyboard.push([
    {
      text: "📥 Все Skin",
      callback_data: `skin_select_all_${page}`
    },
    {
      text: "🗑️ Очистить Skin",
      callback_data: `skin_clear_all_${page}`
    }
  ]);
  
  // Секция 4: Выбор редкостей
  inlineKeyboard.push([{ text: "⭐ Секция: Редкость", callback_data: "rarity_section" }]);
  
  // Кнопки для редкостей (по 1-2 в строку)
  for (let i = 0; i < currentRarities.length; i++) {
    const rarity = currentRarities[i];
    const icon = rarity.selected ? "⭐" : "⬜";
    const buttonText = `${icon} ${rarity.name}`;
    
    inlineKeyboard.push([{
      text: buttonText,
      callback_data: `rarity_toggle_${encodeURIComponent(rarity.name)}_${rarityPage}`
    }]);
  }
  
  // Кнопки навигации для редкостей
  const rarityNavRow = [];
  if (rarityPage > 0) {
    rarityNavRow.push({
      text: "⬅️ Rarity",
      callback_data: `rarity_page_${rarityPage - 1}`
    });
  }
  
  if (rarityEndIndex < rarities.length) {
    rarityNavRow.push({
      text: "Rarity ➡️",
      callback_data: `rarity_page_${rarityPage + 1}`
    });
  }
  
  if (rarityNavRow.length > 0) {
    inlineKeyboard.push(rarityNavRow);
  }
  
  // Кнопки выбора всех/очистки для редкостей
  inlineKeyboard.push([
    {
      text: "📥 Все Rarity",
      callback_data: `rarity_select_all_${rarityPage}`
    },
    {
      text: "🗑️ Очистить Rarity",
      callback_data: `rarity_clear_all_${rarityPage}`
    }
  ]);
  
  // Главные кнопки действий
  inlineKeyboard.push([
    {
      text: "🔄 Сортировать",
      callback_data: "synergy_sort_execute"
    },
    {
      text: "📊 Статистика",
      callback_data: "synergy_stats"
    }
  ]);
  
  return inlineKeyboard;
}

/**
 * Создает сообщение с текущими настройками
 */
function createSelectionMessage(synergyLevel, skinTones, rarities, filterOptions = null, page = 0, rarityPage = 0) {
  const selectedSkinTones = skinTones.filter(tone => tone.selected);
  const selectedRarities = rarities.filter(rarity => rarity.selected);
  const selectedCount = selectedSkinTones.length;
  const rarityCount = selectedRarities.length;
  
  // Используем значения по умолчанию если filterOptions не передан
  const safeFilterOptions = filterOptions || {
    allNfts: true,
    onSaleOnly: false
  };
  
  let message = "🔍 Сортировка NFT по синергиям и редкости\n\n";
  
  message += "🎯 Параметры поиска:\n";
  message += `• Синергия: ${synergyLevel}+ вхождения из файла синергий\n`;
  message += `• Skin Tone: ${selectedCount > 0 ? selectedCount + ' выбрано' : 'Все'}\n`;
  message += `• Редкости: ${rarityCount > 0 ? rarityCount + ' выбрано' : 'Все'}\n`;
  message += `• Фильтр: ${safeFilterOptions.allNfts ? 'Все NFT' : ''} ${safeFilterOptions.onSaleOnly ? 'На продаже' : ''}\n`;
  
  if (selectedCount > 0) {
    message += "• Выбраны Skin Tone: ";
    const toneNames = selectedSkinTones.map(t => t.name).slice(0, 3);
    message += toneNames.join(", ");
    if (selectedCount > 3) {
      message += ` ... и еще ${selectedCount - 3}`;
    }
    message += "\n";
  }
  
  if (rarityCount > 0) {
    message += "• Выбраны редкости: ";
    const rarityNames = selectedRarities.map(r => r.name).slice(0, 3);
    message += rarityNames.join(", ");
    if (rarityCount > 3) {
      message += ` ... и еще ${rarityCount - 3}`;
    }
    message += "\n";
  }
  
  message += `\n📊 Как работает:\n`;
  message += `• 2+ вхождения - ищет NFT где атрибуты встречаются в одной синергии минимум 2 раза\n`;
  message += `• 3+ вхождения - ищет NFT где атрибуты встречаются в одной синергии минимум 3 раза\n`;
  message += `• Используются точные совпадения с файлом synergy_state.json\n`;
  message += `• Skin Tone не участвует в подсчете синергии\n`;
  message += `• Редкости фильтруют атрибуты по уровню редкости\n`;
  message += `• "Все NFT" - сохраняет все найденные NFT\n`;
  message += `• "На продаже" - дополнительно проверяет через TON API и сохраняет только NFT на продаже\n`;
  message += `• Результаты сохраняются в отдельные файлы для дальнейшей работы\n`;
  message += `• Пример: "Gold" в Gold, Gold Braid, Spiked Gold = 3 совпадения по синергии Gold\n\n`;
  
  message += "🔄 Управление:\n";
  message += "• Нажимайте на Skin Tone/Rarity для выбора\n";
  message += "• Используйте кнопки навигации\n";
  message += "• 'Все/Очистить' - массовые операции\n";
  message += "• 'Все NFT'/'На продаже' - переключение фильтров\n";
  message += "• Результаты сохраняются в Orc_filtered_[username]_[id].json\n";
  message += "• NFT на продаже сохраняются в Orc_filtered_onsale_[username]_[id].json\n";
  
  // Внутри функции createSelectionMessage добавьте:
  message += `• Фильтр: ${safeFilterOptions.allNfts ? '✅ Все NFT' : '⬜ Все NFT'} | `;
  message += `${safeFilterOptions.onSaleOnly ? '✅ На продаже' : '⬜ На продаже'}\n`;

  // И добавьте пояснение:
  message += `\n💡 *Фильтры (взаимоисключающие):*\n`;
  message += `• ✅ Все NFT - показывает все найденные NFT\n`;
  message += `• ✅ На продаже - проверяет через TON API, показывает только NFT на продаже\n`;

  return message;
}

// ====== ФУНКЦИИ ПОИСКА И СОРТИРОВКИ ======

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
  
  // Отладочная информация
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
    
    // Выводим примеры
    console.log(`📋 Примеры найденных NFT:`);
    results.slice(0, 3).forEach((result, i) => {
      console.log(`   ${i+1}. NFT #${result.nft.index}: ${result.synergyScore} совпадений`);
      if (result.matchingSynergies && result.matchingSynergies.length > 0) {
        const synergy = result.matchingSynergies[0];
        console.log(`      • Синергия: "${synergy.synergyName}"`);
        console.log(`      • Атрибуты: ${synergy.attributes.map(a => a.attribute).join(', ')}`);
        console.log(`      • Skin Tone: ${result.skinTone}`);
        console.log(`      • Редкость: ${result.rarity}`);
      }
    });
  } else {
    console.log(`❌ Не найдено NFT с выбранными критериями`);
    console.log(`   • Уровень синергии: ${synergyLevel}`);
    console.log(`   • Выбранные редкости: ${selectedRarities.map(r => r.name).join(', ') || 'Все'}`);
    console.log(`   • Выбранные Skin Tone: ${selectedSkinTones.map(t => t.name).join(', ') || 'Все'}`);
  }
  
  return results;
}

/**
 * Создает сообщение с результатами
 */
function createResultsMessage(results, synergyLevel, selectedSkinTones, selectedRarities, totalNfts, saveResult = null, filterOptions = null) {
  const skinCount = selectedSkinTones.length;
  const rarityCount = selectedRarities.length;
  
  let message = "🎯 Результаты сортировки по синергиям и редкости\n\n";
  
  message += "📋 Параметры поиска:\n";
  message += `• Минимальные совпадения: ${synergyLevel}+ вхождения\n`;
  message += `• Skin Tone: ${skinCount > 0 ? skinCount + ' выбрано' : 'Все'}\n`;
  message += `• Редкости атрибутов: ${rarityCount > 0 ? rarityCount + ' выбрано' : 'Все'}\n`;
  
  if (filterOptions) {
    message += `• Фильтр: ${filterOptions.allNfts ? 'Все NFT' : ''} ${filterOptions.onSaleOnly ? 'На продаже' : ''}\n`;
  }
  
  if (rarityCount > 0) {
    const rarityNames = selectedRarities.slice(0, 3).join(', ');
    message += `• Ищем совпадения только среди: ${rarityNames}`;
    if (rarityCount > 3) {
      message += ` ... и еще ${rarityCount - 3}`;
    }
    message += "\n";
  }
  
  message += `• Найдено NFT: ${results.length} из ${totalNfts}\n\n`;
  
  // Информация о сохранении файлов
  if (saveResult && saveResult.success) {
    message += `💾 *Сохранено в основной файл:* ${saveResult.fileName}\n`;
    message += `📁 *Количество NFT:* ${saveResult.nftsCount}\n`;
    
    if (saveResult.onSaleFile) {
      if (saveResult.onSaleFile.success) {
        message += `\n💰 *NFT на продаже:*\n`;
        message += `   • Найдено: ${saveResult.onSaleFile.nftsCount || 0} NFT\n`;
        
        if (saveResult.onSaleFile.stats) {
          message += `   • Проверено NFT: ${saveResult.onSaleFile.stats.total || 0}\n`;
          message += `   • Ошибок проверки: ${saveResult.onSaleFile.stats.errors || 0}\n`;
        }
        
        if (saveResult.onSaleFile.saveResult) {
          message += `   • Файл: ${saveResult.onSaleFile.saveResult.fileName || 'не сохранен'}\n`;
        }
      } else {
        message += `\n💰 *Проверка NFT на продаже:*\n`;
        message += `   • ${saveResult.onSaleFile.message || 'Не выполнено'}\n`;
        if (saveResult.onSaleFile.error) {
          message += `   • Ошибка: ${saveResult.onSaleFile.error}\n`;
        }
      }
    }
    
    message += "\n";
  }
  
  if (results.length === 0) {
    message += "❌ NFT не найдены\n\n";
    message += "💡 Возможные причины:\n";
    message += `• Нет NFT где атрибуты встречаются в одной синергии ${synergyLevel} или более раз\n`;
    
    if (rarityCount > 0) {
      message += `• Нет NFT с атрибутами выбранных редкостей\n`;
    }
    
    if (skinCount > 0) {
      message += `• Нет NFT с выбранными Skin Tone\n`;
    }
    
    message += "• Попробуйте изменить критерии поиска\n";
    message += "• Учтите, что используются точные совпадения с файлом synergy_state.json\n";
    
    return message;
  }
  
  // Фильтруем результаты по выбранному уровню синергии
  const filteredResults = results.filter(result => 
    synergyLevel === 2 ? result.synergyScore >= 2 : result.synergyScore >= 3
  );
  
  if (filteredResults.length === 0) {
    message += `❌ Нет NFT с ${synergyLevel} совпадениями\n\n`;
    message += `💡 Попробуйте изменить уровень синергии\n`;
    return message;
  }
  
  // Показываем топ-topCount результатов
  const topCount = 5;
  const topResults = filteredResults.slice(0, topCount);
  
  for (let i = 0; i < topResults.length; i++) {
    const result = topResults[i];
    const nft = result.nft;
    const nftName = nft.name || `NFT #${nft.index || i+1}`;
    // НЕ используем escapeMarkdown, чтобы не экранировать символы
    const cleanName = nftName.replace(/\\/g, ''); // Убираем обратные косые черты
    
    message += `${i+1}. ${truncateText(cleanName, 30)}\n`;
    message += `   🎯 Синергия: ${result.synergyScore} совпадения\n`;
    message += `   🎨 Skin Tone: ${result.skinTone}\n`;
    
    if (result.matchingSynergies && result.matchingSynergies.length > 0) {
      const synergy = result.matchingSynergies[0];
      message += `   🔄 Синергия: "${synergy.synergyName}"\n`;
      message += `   ⭐ Редкость: ${result.rarity}\n`;
      
      const attributesStr = synergy.attributes.map(a => `${a.trait_type}: "${a.attribute}"`).slice(0, 3).join(', ');
      message += `   📝 Атрибуты: ${attributesStr}\n`;
      
      if (synergy.attributes.length > 3) {
        message += `   ... и еще ${synergy.attributes.length - 3} атрибутов\n`;
      }
    }
      
    message += "\n";
  }
  
  if (filteredResults.length > topCount) {
    message += `📈 ... и еще ${filteredResults.length - topCount} NFT\n\n`;
  }
  
  // Статистика по редкостям совпадений
  const rarityStats = {};
  filteredResults.forEach(result => {
    const rarity = result.rarity;
    rarityStats[rarity] = (rarityStats[rarity] || 0) + 1;
  });
  
  const topRarities = Object.entries(rarityStats)
    .sort(([,a], [,b]) => b - a);
  
  if (topRarities.length > 0) {
    message += "📊 Распределение по редкостям совпадений:\n";
    topRarities.forEach(([rarity, count], index) => {
      message += `${index+1}. ${rarity}: ${count} NFT\n`;
    });
    message += "\n";
  }
  
  // Статистика по синергиям
  const synergyStats = {};
  filteredResults.forEach(result => {
    if (result.matchingSynergies && result.matchingSynergies.length > 0) {
      const synergyName = result.matchingSynergies[0].synergyName;
      synergyStats[synergyName] = (synergyStats[synergyName] || 0) + 1;
    }
  });
  
  const topSynergies = Object.entries(synergyStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  if (topSynergies.length > 0) {
    message += "🏆 Популярные синергии:\n";
    topSynergies.forEach(([synergy, count], index) => {
      message += `${index+1}. "${synergy}": ${count} NFT\n`;
    });
    message += "\n";
  }
  
  // Инструкция по дальнейшей работе
  if (saveResult && saveResult.success) {
    message += "💡 *Дальнейшая работа:*\n";
    message += `• Основной файл: \`${saveResult.fileName}\` (${saveResult.nftsCount} NFT)\n`;
    
    if (saveResult.onSaleFile && saveResult.onSaleFile.success && saveResult.onSaleFile.saveResult) {
      message += `• Файл NFT на продаже: \`${saveResult.onSaleFile.saveResult.fileName}\` (${saveResult.onSaleFile.nftsCount || 0} NFT)\n`;
    }
    
    message += "• Используйте другие команды бота для работы с отфильтрованными NFT\n";
    message += "• При следующей фильтрации файлы будут перезаписаны\n";
  }
    
  return message;
}

/**
 * Создает клавиатуру для результатов
 */
function createResultsKeyboard(results, synergyLevel, selectedSkinTones, hasSavedFile = false, hasOnSaleFile = false) {
  const inlineKeyboard = [];
  const viewCount = 3; 
  
  // Кнопки для детального просмотра первых viewCount NFT
  for (let i = 0; i < Math.min(viewCount, results.length); i++) {
    const nft = results[i].nft;
    const nftName = nft.name || `NFT #${nft.index || i+1}`;
    const buttonText = `🔍 ${i+1}. ${truncateText(nftName, 15)}`;
    
    inlineKeyboard.push([{
      text: buttonText,
      callback_data: `result_detail_${i}_${synergyLevel}`
    }]);
  }
  
  // Кнопки для работы с файлами
  const fileButtons = [];
  
  if (hasSavedFile) {
    fileButtons.push({
      text: "📁 Все NFT",
      callback_data: "result_load_file"
    });
  }
  
  if (hasOnSaleFile) {
    fileButtons.push({
      text: "💰 На продаже",
      callback_data: "result_load_onsale"
    });
  }
  
  if (fileButtons.length > 0) {
    inlineKeyboard.push(fileButtons);
  }
  
  // Кнопки удаления файлов
  const deleteButtons = [];
  
  if (hasSavedFile) {
    deleteButtons.push({
      text: "🗑️ Все NFT",
      callback_data: "result_delete_file"
    });
  }
  
  if (hasOnSaleFile) {
    deleteButtons.push({
      text: "🗑️ На продаже",
      callback_data: "result_delete_onsale"
    });
  }
  
  if (deleteButtons.length > 0) {
    inlineKeyboard.push(deleteButtons);
  }
  
  // Кнопки действий
  inlineKeyboard.push([
    {
      text: "🔄 Новый поиск",
      callback_data: "synergy_new_search"
    },
    {
      text: "📊 Статистика",
      callback_data: "synergy_stats"
    }
  ]);
  
  // Кнопка возврата к выбору параметров
  inlineKeyboard.push([{
    text: "⚙️ Изменить параметры",
    callback_data: "synergy_change_params"
  }]);
  
  return inlineKeyboard;
}

// ====== ОСНОВНЫЕ ОБРАБОТЧИКИ ======

/**
 * Обработчик команды /synergy_sort
 */
async function handleSynergySort(bot, msg) {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;
  
  try {
    console.log(`🎯 Команда /synergy_sort от ${userId} (${username})`);
    
    // Загружаем данные атрибутов
    const attributesData = await loadAttributesPowerData();
    const skinTones = attributesData.skinTones || [];
    const rarities = attributesData.rarities || [];
    
    if (skinTones.length === 0) {
      await bot.sendMessage(chatId, 
        "❌ Не удалось загрузить данные атрибутов. Убедитесь что файл attributes_power_data.json существует."
      );
      return;
    }
    
    // Загружаем состояние для конкретного пользователя
    const state = await loadSynergyState(userId);
    
    // Убеждаемся что у состояния есть filterOptions
    if (!state.filterOptions) {
      state.filterOptions = {
        allNfts: true,
        onSaleOnly: false
      };
    }
    
    // Создаем сообщение с интерфейсом выбора
    const message = createSelectionMessage(state.synergyLevel, skinTones, rarities, state.filterOptions);
    const keyboard = createSelectionKeyboard(state.synergyLevel, skinTones, rarities, state.filterOptions, 0, 0);
    
    await bot.sendMessage(chatId, message, {
      parse_mode: undefined, // Убираем разметку Markdown
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    
    console.log(`✅ Интерфейс сортировки отправлен пользователю ${userId} (${username})`);
    
  } catch (error) {
    console.error('❌ Ошибка в handleSynergySort:', error);
    await bot.sendMessage(chatId, 
      `❌ Ошибка при создании интерфейса сортировки:\n${error.message}`
    );
  }
}

/**
 * Обработчик callback-запросов для интерфейса сортировки
 */
async function handleSynergyCallback(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.username || callbackQuery.from.first_name;
  const data = callbackQuery.data;
  
  console.log(`📞 Synergy callback от ${userId} (${username}): ${data}`);
  
  try {
    // Загружаем текущие данные
    const attributesData = await loadAttributesPowerData();
    const skinTones = attributesData.skinTones || [];
    const rarities = attributesData.rarities || [];
    
    // Загружаем состояние и ВОССТАНАВЛИВАЕМ выбранные редкости для конкретного пользователя
    let state = await loadSynergyState(userId);
    
    // Убеждаемся что у состояния есть filterOptions
    if (!state.filterOptions) {
      state.filterOptions = {
        allNfts: true,
        onSaleOnly: false
      };
    }
    
    // Восстанавливаем выбранные Skin Tone
    skinTones.forEach(tone => {
      tone.selected = state.selectedSkinTones.includes(tone.name);
    });
    
    // Восстанавливаем выбранные редкости
    rarities.forEach(rarity => {
      rarity.selected = state.selectedRarities.includes(rarity.name);
    });
    
    let currentPage = 0;
    let currentRarityPage = 0;
    let needsUpdate = false;
    
    // Парсим данные для определения действия
    if (data.startsWith('synergy_select_')) {
      // Выбор уровня синергии
      const level = parseInt(data.split('_')[2]);
      if ([2, 3].includes(level) && state.synergyLevel !== level) {
        state.synergyLevel = level;
        await saveSynergyState(userId, state);
        needsUpdate = true;
      }
      
    } else if (data === 'filter_all') {
      // Переключение чекбокса "Все NFT" - ВЗАИМОИСКЛЮЧАЮЩАЯ ЛОГИКА
      const newValue = !state.filterOptions.allNfts;
      state.filterOptions.allNfts = newValue;
      
      // Делаем чекбоксы взаимоисключающими
      if (newValue) {
        state.filterOptions.onSaleOnly = false; // Если включаем "Все", выключаем "На продаже"
      }
      
      await saveSynergyState(userId, state);
      needsUpdate = true;
      
    } else if (data === 'filter_on_sale') {
      // Переключение чекбокса "На продаже" - ВЗАИМОИСКЛЮЧАЮЩАЯ ЛОГИКА
      const newValue = !state.filterOptions.onSaleOnly;
      state.filterOptions.onSaleOnly = newValue;
      
      // Делаем чекбоксы взаимоисключающими
      if (newValue) {
        state.filterOptions.allNfts = false; // Если включаем "На продаже", выключаем "Все"
      }
      
      await saveSynergyState(userId, state);
      needsUpdate = true;
      
    } else if (data.startsWith('skin_toggle_')) {
      // Переключение выбора Skin Tone
      const parts = data.split('_');
      const skinName = parts[2];
      currentPage = parseInt(parts[3]) || 0;
      
      const toneIndex = skinTones.findIndex(t => t.name === skinName);
      if (toneIndex !== -1) {
        skinTones[toneIndex].selected = !skinTones[toneIndex].selected;
        needsUpdate = true;
      }
      
    } else if (data.startsWith('skin_page_')) {
      // Переход на страницу Skin Tone
      currentPage = parseInt(data.split('_')[2]) || 0;
      needsUpdate = true;
      
    } else if (data.startsWith('skin_select_all_')) {
      // Выбрать все Skin Tone на текущей странице
      currentPage = parseInt(data.split('_')[3]) || 0;
      const startIndex = currentPage * 8;
      const endIndex = startIndex + 8;
      
      for (let i = startIndex; i < endIndex && i < skinTones.length; i++) {
        if (!skinTones[i].selected) {
          skinTones[i].selected = true;
          needsUpdate = true;
        }
      }
      
    } else if (data.startsWith('skin_clear_all_')) {
      // Очистить все Skin Tone на текущей странице
      currentPage = parseInt(data.split('_')[3]) || 0;
      const startIndex = currentPage * 8;
      const endIndex = startIndex + 8;
      
      for (let i = startIndex; i < endIndex && i < skinTones.length; i++) {
        if (skinTones[i].selected) {
          skinTones[i].selected = false;
          needsUpdate = true;
        }
      }
      
    } else if (data.startsWith('rarity_toggle_')) {
      // Переключение выбора редкости
      const parts = data.split('_');
      const rarityName = decodeURIComponent(parts[2]); // Декодируем специальные символы
      currentRarityPage = parseInt(parts[3]) || 0;
      
      const rarityIndex = rarities.findIndex(r => r.name === rarityName);
      if (rarityIndex !== -1) {
        rarities[rarityIndex].selected = !rarities[rarityIndex].selected;
        needsUpdate = true;
        console.log(`✅ Редкость ${rarityName} переключена: ${rarities[rarityIndex].selected}`);
      }
      
    } else if (data.startsWith('rarity_page_')) {
      // Переход на страницу редкостей
      currentRarityPage = parseInt(data.split('_')[2]) || 0;
      needsUpdate = true;
      
    } else if (data.startsWith('rarity_select_all_')) {
      // Выбрать все редкости на текущей странице
      currentRarityPage = parseInt(data.split('_')[3]) || 0;
      const startIndex = currentRarityPage * 5;
      const endIndex = startIndex + 5;
      
      for (let i = startIndex; i < endIndex && i < rarities.length; i++) {
        if (!rarities[i].selected) {
          rarities[i].selected = true;
          needsUpdate = true;
        }
      }
      
    } else if (data.startsWith('rarity_clear_all_')) {
      // Очистить все редкости на текущей странице
      currentRarityPage = parseInt(data.split('_')[3]) || 0;
      const startIndex = currentRarityPage * 5;
      const endIndex = startIndex + 5;
      
      for (let i = startIndex; i < endIndex && i < rarities.length; i++) {
        if (rarities[i].selected) {
          rarities[i].selected = false;
          needsUpdate = true;
        }
      }
      
    } else if (data === 'synergy_sort_execute') {
      // Выполнение сортировки
      await executeSynergySort(bot, callbackQuery, skinTones, rarities, state, userId, username);
      return; // Не обновляем интерфейс
      
    } else if (data === 'synergy_new_search' || data === 'synergy_change_params') {
      // Возврат к выбору параметров
      currentPage = 0;
      currentRarityPage = 0;
      needsUpdate = true;
      
    } else if (data === 'synergy_stats') {
      // Показ статистики
      await showSynergyStats(bot, callbackQuery, userId, username);
      return;
      
    } else if (data === 'synergy_back_to_select') {
      // Возврат из статистики
      needsUpdate = true;
      
    } else if (data.startsWith('result_detail_')) {
      // Просмотр деталей NFT
      await showResultDetails(bot, callbackQuery, userId, username);
      return;
      
    } else if (data === 'result_load_file') {
      // Загрузка основного файла пользователя
      await loadUserFile(bot, callbackQuery, userId, username, false);
      return;
      
    } else if (data === 'result_load_onsale') {
      // Загрузка файла с NFT на продаже
      await loadUserFile(bot, callbackQuery, userId, username, true);
      return;
      
    } else if (data === 'result_delete_file') {
      // Удаление основного файла пользователя
      await deleteUserFile(bot, callbackQuery, userId, username, false);
      return;
      
    } else if (data === 'result_delete_onsale') {
      // Удаление файла с NFT на продаже
      await deleteUserFile(bot, callbackQuery, userId, username, true);
      return;
      
    } else {
      // Неизвестная команда
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Неизвестная команда' });
      return;
    }
    
    // Обновляем состояние
    const selectedSkinTones = skinTones.filter(t => t.selected);
    const selectedRarities = rarities.filter(r => r.selected);
    
    state.selectedSkinTones = selectedSkinTones.map(t => t.name);
    state.selectedRarities = selectedRarities.map(r => r.name);
    await saveSynergyState(userId, state);
    
    console.log(`💾 Сохранено состояние пользователя ${userId}:`);
    console.log(`   • Skin Tone: ${state.selectedSkinTones.length} выбрано`);
    console.log(`   • Редкости: ${state.selectedRarities.length} выбрано`);
    console.log(`   • Фильтры: Все NFT=${state.filterOptions.allNfts}, На продаже=${state.filterOptions.onSaleOnly}`);
    
    // Обновляем интерфейс только если нужно
    if (needsUpdate) {
      const message = createSelectionMessage(state.synergyLevel, skinTones, rarities, state.filterOptions, currentPage, currentRarityPage);
      const keyboard = createSelectionKeyboard(state.synergyLevel, skinTones, rarities, state.filterOptions, currentPage, currentRarityPage);
      
      try {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: undefined,
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      } catch (error) {
        // Игнорируем ошибку "сообщение не изменено"
        if (!error.message.includes('message is not modified')) {
          throw error;
        }
      }
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    console.error('❌ Ошибка в handleSynergyCallback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка при обработке' });
  }
}

/**
 * Выполнение сортировки
 */
async function executeSynergySort(bot, callbackQuery, skinTones, rarities, state, userId, username) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    // Показываем сообщение о начале поиска
    await bot.editMessageText(
      `🔍 *Выполняю сортировку...*\n\n` +
      `⏳ Загружаю данные NFT и синергии...`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: undefined
      }
    );
    
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Начинаю поиск...' });
    
    // Загружаем данные NFT
    const data = await loadNftData();
    const nfts = data.nfts;
    
    if (nfts.length === 0) {
      await bot.editMessageText(
        `❌ *База данных NFT пуста*\n\n` +
        `Сначала соберите данные с помощью:\n` +
        `/start_collect\n\n` +
        `💡 После сбора данных повторите сортировку.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: undefined
        }
      );
      return;
    }
    
    // Загружаем карту синергий
    const synergyMap = await loadSynergyMap();
    if (Object.keys(synergyMap).length === 0) {
      await bot.editMessageText(
        `❌ *Файл синергий пуст или не найден*\n\n` +
        `Убедитесь что файл synergy_state.json существует в директории данных.\n` +
        `Содержимое файла должно быть в формате:\n` +
        `{\n` +
        `  "Gold": ["Gold", "Gold Braid", "Spiked Gold"],\n` +
        `  "Cosmic": ["Cosmic", "Cosmic Cocktail"]\n` +
        `}`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: undefined
        }
      );
      return;
    }
    
    // Получаем выбранные Skin Tone и редкости
    const selectedSkinTones = skinTones.filter(t => t.selected);
    const selectedRarities = rarities.filter(r => r.selected);
    const selectedSkinNames = selectedSkinTones.map(t => t.name);
    const selectedRarityNames = selectedRarities.map(r => r.name);
    
    // ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
    console.log(`🎯 Параметры поиска пользователя ${userId}:`);
    console.log(`   • Уровень синергии: ${state.synergyLevel}`);
    console.log(`   • Выбрано Skin Tone: ${selectedSkinTones.length}`);
    console.log(`   • Выбрано редкостей: ${selectedRarityNames.length}`);
    console.log(`   • Фильтры: Все NFT=${state.filterOptions.allNfts}, На продаже=${state.filterOptions.onSaleOnly}`);
    console.log(`   • Загружено синергий: ${Object.keys(synergyMap).length}`);
    
    let progressMessage = `🔍 *Выполняю сортировку...*\n\n` +
      `✅ Загружено ${nfts.length} NFT\n` +
      `✅ Загружено ${Object.keys(synergyMap).length} синергий\n` +
      `🎯 Параметры:\n` +
      `• Синергия: ${state.synergyLevel}+ совпадений\n` +
      `• Skin Tone: ${selectedSkinNames.length > 0 ? selectedSkinNames.length + ' выбрано' : 'Все'}\n` +
      `• Редкости: ${selectedRarityNames.length > 0 ? selectedRarityNames.length + ' выбрано' : 'Все'}\n` +
      `• Фильтр: ${state.filterOptions.allNfts ? 'Все NFT' : ''} ${state.filterOptions.onSaleOnly ? 'На продаже' : ''}\n`;
    
    if (state.filterOptions.onSaleOnly) {
      progressMessage += `• Используются точные совпадения с файлом synergy_state.json\n` +
        `• Будут проверены NFT через TON API (с паузами для избежания rate limit)\n` +
        `⏳ Ищу совпадения...`;
    } else {
      progressMessage += `• Используются точные совпадения с файлом synergy_state.json\n` +
        `⏳ Ищу совпадения...`;
    }
    
    await bot.editMessageText(progressMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: undefined
    });
    
    // Выполняем поиск
    const results = await findNftsWithCriteria(
      nfts, 
      state.synergyLevel, 
      selectedSkinTones,
      selectedRarities
    );
    
    // Подготавливаем параметры поиска для сохранения
    const searchParams = {
      synergyLevel: state.synergyLevel,
      selectedSkinTones: selectedSkinNames,
      selectedRarities: selectedRarityNames,
      searchDate: new Date().toISOString(),
      totalNfts: nfts.length,
      foundNfts: results.length,
      synergyCount: Object.keys(synergyMap).length
    };
    
    // Сохраняем результаты в файл
    const saveResult = await saveFilteredNfts(userId, username, results, searchParams, state.filterOptions);
    
    // Сохраняем состояние
    state.lastSearch = new Date().toISOString();
    state.lastResultsCount = results.length;
    state.lastResults = results.slice(0, 50); // Сохраняем только первые 50 результатов
    state.lastSearchParams = searchParams;
    await saveSynergyState(userId, state);
    
    // Проверяем есть ли сохраненные файлы
    const hasSavedFile = saveResult.success;
    const hasOnSaleFile = saveResult.onSaleFile && saveResult.onSaleFile.success;
    
    // Создаем сообщение с результатами
    const resultsMessage = createResultsMessage(
      results, 
      state.synergyLevel, 
      selectedSkinNames, 
      selectedRarityNames,
      nfts.length,
      saveResult,
      state.filterOptions
    );
    
    const resultsKeyboard = createResultsKeyboard(
      results, 
      state.synergyLevel, 
      selectedSkinNames,
      hasSavedFile,
      hasOnSaleFile
    );
    
    await bot.editMessageText(resultsMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: undefined, // Убираем разметку Markdown
      reply_markup: {
        inline_keyboard: resultsKeyboard
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка в executeSynergySort:', error);
    
    await bot.editMessageText(
      `❌ *Ошибка при сортировке*\n\n` +
      `🔧 Детали:\n${error.message}\n\n` +
      `💡 Проверьте данные и попробуйте снова.`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: undefined
      }
    );
  }
}

/**
 * Загружает файл пользователя
 */
async function loadUserFile(bot, callbackQuery, userId, username, onSaleOnly = false) {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const fileType = onSaleOnly ? 'на продаже' : 'основной';
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Загружаю ${fileType} файл...` });
    
    const loadResult = await loadFilteredNfts(userId, username, onSaleOnly);
    
    if (!loadResult.success) {
      await bot.sendMessage(chatId,
        `❌ *Файл не найден*\n\n` +
        `У вас нет сохраненного ${fileType} файла.\n` +
        `Сначала выполните поиск с помощью кнопки "🔄 Сортировать".`,
        { parse_mode: undefined }
      );
      return;
    }
    
    const data = loadResult.data;
    const nftsCount = data.nfts?.length || 0;
    const metadata = data.metadata || {};
    
    let message = `📁 *Загружен файл:* ${loadResult.fileName}\n\n`;
    message += `📊 *Информация о файле:*\n`;
    message += `• Пользователь: ${metadata.username || username}\n`;
    message += `• NFT в файле: ${nftsCount}\n`;
    message += `• Тип: ${onSaleOnly ? 'NFT на продаже' : 'Все NFT'}\n`;
    message += `• Сохранен: ${new Date(metadata.savedAt).toLocaleString('ru-RU')}\n\n`;
    
    if (metadata.searchParams) {
      const params = metadata.searchParams;
      message += `🎯 *Параметры поиска:*\n`;
      message += `• Синергия: ${params.synergyLevel}+ совпадений\n`;
      message += `• Skin Tone: ${params.selectedSkinTones.length > 0 ? params.selectedSkinTones.length + ' выбрано' : 'Все'}\n`;
      message += `• Редкости: ${params.selectedRarities.length > 0 ? params.selectedRarities.length + ' выбрано' : 'Все'}\n`;
      message += `• Синергий в базе: ${params.synergyCount || 0}\n`;
      message += `• Найдено: ${params.foundNfts} из ${params.totalNfts} NFT\n`;
      
      if (metadata.filterOptions) {
        message += `• Фильтр: ${metadata.filterOptions.allNfts ? 'Все NFT' : ''} ${metadata.filterOptions.onSaleOnly ? 'На продаже' : ''}\n`;
      }
      
      message += "\n";
    }
    
    // Дополнительная информация для файла на продаже
    if (onSaleOnly) {
      if (metadata.api_stats?.processing_stats) {
        const stats = metadata.api_stats.processing_stats;
        message += `💰 *Статистика проверки:*\n`;
        message += `• Проверено NFT: ${stats.total || nftsCount}\n`;
        message += `• На продаже: ${stats.onSale || 0}\n`;
        message += `• Ошибок: ${stats.errors || 0}\n`;
        message += `• Пауз: ${stats.pauses || 0}\n\n`;
      }
    }
    
    // Показываем первые 3 NFT из файла
    if (nftsCount > 0) {
      message += `📋 *Первые NFT из файла:*\n\n`;
      
      const firstNfts = data.nfts.slice(0, 3);
      firstNfts.forEach((nft, index) => {
        const nftName = nft.name || `NFT #${nft.index || index+1}`;
        const cleanName = nftName.replace(/\\/g, '');
        
        message += `${index+1}. ${truncateText(cleanName, 30)}\n`;
        
        if (nft.synergyInfo) {
          message += `   🎯 Синергия: ${nft.synergyInfo.synergyScore}\n`;
          message += `   🎨 Skin Tone: ${nft.synergyInfo.skinTone}\n`;
          message += `   ⭐ Редкость: ${nft.synergyInfo.rarity}\n`;
          
          if (nft.synergyInfo.matchingSynergies && nft.synergyInfo.matchingSynergies.length > 0) {
            const synergy = nft.synergyInfo.matchingSynergies[0];
            message += `   🔄 Синергия: "${synergy.synergyName}"\n`;
          }
        }
        
        // Информация о продаже для файла на продаже
        if (onSaleOnly && nft.on_sale) {
          message += `   💰 На продаже: ДА\n`;
          if (nft.sale_price) {
            const priceTon = (parseInt(nft.sale_price.value) / Math.pow(10, nft.sale_price.decimals || 9)).toFixed(2);
            message += `   💵 Цена: ${priceTon} TON\n`;
          }
        }
        
        message += "\n";
      });
      
      if (nftsCount > 3) {
        message += `📈 ... и еще ${nftsCount - 3} NFT\n\n`;
      }
    }
    
    message += `💡 *Дальнейшие действия:*\n`;
    message += `• Используйте команду /process_filtered для обработки этих NFT\n`;
    message += `• Или выполните новый поиск для обновления файла\n`;
    
    await bot.sendMessage(chatId, message, { parse_mode: undefined });
    
  } catch (error) {
    console.error('❌ Ошибка в loadUserFile:', error);
    await bot.sendMessage(chatId,
      `❌ *Ошибка загрузки файла*\n\n${error.message}`,
      { parse_mode: undefined }
    );
  }
}

/**
 * Удаляет файл пользователя
 */
async function deleteUserFile(bot, callbackQuery, userId, username, onSaleOnly = false) {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const fileType = onSaleOnly ? 'на продаже' : 'основной';
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Удаляю ${fileType} файл...` });
    
    const deleteResult = await deleteFilteredNfts(userId, username, onSaleOnly);
    
    if (!deleteResult.success) {
      await bot.sendMessage(chatId,
        `❌ *Файл не найден*\n\n` +
        `У вас нет сохраненного ${fileType} файла.`,
        { parse_mode: undefined }
      );
      return;
    }
    
    await bot.sendMessage(chatId,
      `✅ *Файл удален*\n\n` +
      `Файл \`${deleteResult.fileName}\` успешно удален.\n` +
      `Вы можете выполнить новый поиск для создания нового файла.`,
      { parse_mode: undefined }
    );
    
  } catch (error) {
    console.error('❌ Ошибка в deleteUserFile:', error);
    await bot.sendMessage(chatId,
      `❌ *Ошибка удаления файла*\n\n${error.message}`,
      { parse_mode: undefined }
    );
  }
}

/**
 * Показывает детали конкретного результата
 */
async function showResultDetails(bot, callbackQuery, userId, username) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  
  try {
    // Извлекаем индекс результата
    const parts = data.split('_');
    const resultIndex = parseInt(parts[2]);
    const synergyLevel = parseInt(parts[3]);
    
    // Загружаем последние результаты пользователя
    const state = await loadSynergyState(userId);
    
    if (!state.lastResults || state.lastResults.length === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: 'Результаты не найдены. Выполните поиск сначала.' 
      });
      return;
    }
    
    if (resultIndex >= state.lastResults.length) {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: 'Результат не найден' 
      });
      return;
    }
    
    const result = state.lastResults[resultIndex];
    const nft = result.nft;
    const nftName = nft.name || `NFT #${nft.index || resultIndex+1}`;
    const cleanName = nftName.replace(/\\/g, '');
    
    let detailsMessage = `🔍 *Детали NFT:* ${cleanName}\n\n`;
    
    detailsMessage += `📊 *Основная информация:*\n`;
    detailsMessage += `• Индекс: ${nft.index || 'Не указан'}\n`;
    detailsMessage += `• Адрес: ${nft.address || 'Не указан'}\n`;
    detailsMessage += `• Синергия: ${result.synergyScore} совпадений\n`;
    detailsMessage += `• Skin Tone: ${result.skinTone}\n`;
    detailsMessage += `• Всего атрибутов: ${result.totalAttributes}\n`;
    detailsMessage += `• Отфильтровано атрибутов: ${result.filteredAttributesCount}\n`;
    detailsMessage += `• Основная редкость: ${result.rarity}\n`;
    
    if (result.matchingSynergies && result.matchingSynergies.length > 0) {
      const synergy = result.matchingSynergies[0];
      detailsMessage += `\n🎯 *Основная синергия:*\n`;
      detailsMessage += `• Название: "${synergy.synergyName}"\n`;
      detailsMessage += `• Количество совпадений: ${synergy.count}\n\n`;
      
      detailsMessage += `🏷️ *Атрибуты с совпадениями:*\n`;
      synergy.attributes.forEach((attr, i) => {
        detailsMessage += `${i+1}. ${attr.trait_type}: "${attr.attribute}"\n`;
      });
    }
    
    // Показываем все синергии NFT
    if (result.allSynergies && Object.keys(result.allSynergies).length > 0) {
      detailsMessage += `\n📋 *Все синергии NFT:*\n`;
      const allSynergies = Object.values(result.allSynergies)
        .sort((a, b) => b.count - a.count);
      
      allSynergies.forEach((synergy, i) => {
        if (i < 5) { // Показываем только топ-5
          detailsMessage += `${i+1}. "${synergy.synergyName}": ${synergy.count} совпадений\n`;
        }
      });
      
      if (Object.keys(result.allSynergies).length > 5) {
        detailsMessage += `... и еще ${Object.keys(result.allSynergies).length - 5} синергий\n`;
      }
    }
    
    detailsMessage += `\n📝 *Все атрибуты NFT:*\n`;
    if (nft.attributes && Array.isArray(nft.attributes)) {
      nft.attributes.forEach((attr, i) => {
        detailsMessage += `${i+1}. ${attr.trait_type}: "${attr.value || 'Нет значения'}"\n`;
      });
    } else {
      detailsMessage += `Нет атрибутов\n`;
    }
    
    // Отправляем детали отдельным сообщением
    await bot.sendMessage(chatId, detailsMessage, { parse_mode: undefined });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    console.error('❌ Ошибка в showResultDetails:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка при загрузке деталей' });
  }
}

/**
 * Показ статистики
 */
async function showSynergyStats(bot, callbackQuery, userId, username) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const data = await loadNftData();
    const nfts = data.nfts;
    const attributesData = await loadAttributesPowerData();
    const skinTones = attributesData.skinTones || [];
    const rarities = attributesData.rarities || [];
    const state = await loadSynergyState(userId);
    
    // Загружаем карту синергий
    const synergyMap = await loadSynergyMap();
    
    const selectedSkinTones = skinTones.filter(t => t.selected);
    const selectedRarities = rarities.filter(r => r.selected);
    const selectedCount = selectedSkinTones.length;
    const rarityCount = selectedRarities.length;
    
    let statsMessage = "📊 *Статистика сортировки*\n\n";
    
    statsMessage += `👤 *Пользователь:* ${username || `user_${userId}`}\n\n`;
    
    statsMessage += "🎯 *Текущие настройки:*\n";
    statsMessage += `• Уровень синергии: ${state.synergyLevel}+\n`;
    statsMessage += `• Выбрано Skin Tone: ${selectedCount}\n`;
    statsMessage += `• Выбрано редкостей: ${rarityCount}\n`;
    statsMessage += `• Фильтры: Все NFT=${state.filterOptions.allNfts ? '✅' : '❌'}, На продаже=${state.filterOptions.onSaleOnly ? '✅' : '❌'}\n`;
    
    if (selectedCount > 0) {
      const names = selectedSkinTones.map(t => t.name).slice(0, 3);
      statsMessage += `• Выбраны Skin Tone: ${names.join(", ")}\n`;
      if (selectedCount > 3) {
        statsMessage += `  ... и еще ${selectedCount - 3}\n`;
      }
    }
    
    if (rarityCount > 0) {
      const names = selectedRarities.map(r => r.name).slice(0, 3);
      statsMessage += `• Выбраны редкости: ${names.join(", ")}\n`;
      if (rarityCount > 3) {
        statsMessage += `  ... и еще ${rarityCount - 3}\n`;
      }
    }
    
    statsMessage += `\n📁 *Данные:*\n`;
    statsMessage += `• Всего NFT в базе: ${nfts.length}\n`;
    statsMessage += `• Вариантов Skin Tone: ${skinTones.length}\n`;
    statsMessage += `• Уровней редкости: ${rarities.length}\n`;
    statsMessage += `• Синергий в базе: ${Object.keys(synergyMap).length}\n`;
    
    // Показываем топ-5 синергий
    const synergyList = Object.entries(synergyMap);
    if (synergyList.length > 0) {
      statsMessage += `\n🏆 *Топ-5 синергий:*\n`;
      synergyList.slice(0, 5).forEach(([synergyName, attributes], index) => {
        statsMessage += `${index+1}. ${synergyName}: ${attributes.length} атрибутов\n`;
        if (index === 0 && attributes.length > 0) {
          statsMessage += `   Примеры: ${attributes.slice(0, 3).join(', ')}\n`;
        }
      });
    }
    
    // Проверяем есть ли сохраненные файлы
    const mainFileCheck = await loadFilteredNfts(userId, username, false);
    const onSaleFileCheck = await loadFilteredNfts(userId, username, true);
    
    if (mainFileCheck.success || onSaleFileCheck.success) {
      statsMessage += `\n💾 *Сохраненные файлы:*\n`;
      
      if (mainFileCheck.success) {
        const fileData = mainFileCheck.data;
        statsMessage += `• Основной файл: ${mainFileCheck.fileName}\n`;
        statsMessage += `  └ NFT: ${fileData.nfts?.length || 0}\n`;
        if (fileData.metadata?.savedAt) {
          const savedAt = new Date(fileData.metadata.savedAt).toLocaleString('ru-RU');
          statsMessage += `  └ Сохранен: ${savedAt}\n`;
        }
      }
      
      if (onSaleFileCheck.success) {
        const fileData = onSaleFileCheck.data;
        statsMessage += `• NFT на продаже: ${onSaleFileCheck.fileName}\n`;
        statsMessage += `  └ NFT: ${fileData.nfts?.length || 0}\n`;
        if (fileData.metadata?.api_stats?.processing_stats) {
          const stats = fileData.metadata.api_stats.processing_stats;
          statsMessage += `  └ Проверено: ${stats.total || 0}\n`;
          statsMessage += `  └ На продаже: ${stats.onSale || 0}\n`;
          statsMessage += `  └ Ошибок: ${stats.errors || 0}\n`;
        }
      }
    }
    
    if (state.lastSearch) {
      const lastSearchDate = new Date(state.lastSearch).toLocaleString('ru-RU');
      statsMessage += `\n⏰ *Последний поиск:*\n`;
      statsMessage += `• Дата: ${lastSearchDate}\n`;
      statsMessage += `• Найдено: ${state.lastResultsCount || 0} NFT\n`;
    }
    
    // Создаем обратную карту атрибутов для статистики
    let totalAttributesInSynergies = 0;
    let uniqueAttributes = new Set();
    
    for (const [synergyName, attributes] of Object.entries(synergyMap)) {
      totalAttributesInSynergies += attributes.length;
      attributes.forEach(attr => uniqueAttributes.add(attr));
    }
    
    statsMessage += `\n📚 *Статистика синергий:*\n`;
    statsMessage += `• Уникальных атрибутов в синергиях: ${uniqueAttributes.size}\n`;
    statsMessage += `• Всего записей атрибутов: ${totalAttributesInSynergies}\n`;
    statsMessage += `• Среднее атрибутов на синергию: ${(totalAttributesInSynergies / Object.keys(synergyMap).length).toFixed(1)}\n`;
    
    statsMessage += `\n💡 *Рекомендации:*\n`;
    statsMessage += `• Для поиска редких комбинаций используйте 3+ совпадения\n`;
    statsMessage += `• Для общего анализа используйте 2+ совпадения\n`;
    statsMessage += `• Используются точные совпадения с файлом synergy_state.json\n`;
    statsMessage += `• Выбирайте конкретные Skin Tone для точного поиска\n`;
    statsMessage += `• "На продаже" проверяет NFT через TON API (занимает время)\n`;
    statsMessage += `• Результаты сохраняются в отдельные файлы для дальнейшей работы\n`;
    
    await bot.editMessageText(statsMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: undefined,
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Вернуться", callback_data: "synergy_back_to_select" }
        ]]
      }
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    console.error('❌ Ошибка в showSynergyStats:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка при получении статистики' });
  }
}

// ====== ЭКСПОРТ ======
module.exports = {
  handleSynergySort,
  handleSynergyCallback,
  
  // Экспортируем функции для работы с файлами
  saveFilteredNfts,
  loadFilteredNfts,
  deleteFilteredNfts,
  
  // Экспортируем для тестирования
  loadAttributesPowerData,
  loadSynergyMap,
  createSelectionKeyboard,
  findNftsWithCriteria,
  loadRarityMap
};