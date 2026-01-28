const { DATA_DIR } = require('./utils.js');
const fs = require('fs').promises;
const path = require('path');

// ====== КОНСТАНТЫ И КОНФИГУРАЦИЯ ======

const ATTRIBUTES_DATA_FILE = path.join(DATA_DIR, 'attributes_power_data.json');
const SYNERGY_MAP_FILE = path.join(DATA_DIR, 'synergy_state.json');
const SYNERGY_EXCEPTIONS_FILE = path.join(DATA_DIR, 'synergy_exceptions.json');

/**
 * Загружает данные исключений из JSON файла
 */
async function loadSynergyExceptions() {
  try {
    const data = await fs.readFile(SYNERGY_EXCEPTIONS_FILE, 'utf8');
    const exceptions = JSON.parse(data);
    
    // Проверяем структуру файла
    if (!exceptions.add) exceptions.add = {};
    if (!exceptions.remove) exceptions.remove = {};
    
    return exceptions;
  } catch (error) {
    // Если файл не существует, возвращаем пустой объект
    if (error.code === 'ENOENT') {
      console.log('⚠️ Файл исключений не найден, создаю стандартный...');
      return { add: {}, remove: {} };
    }
    console.error('❌ Ошибка загрузки данных исключений:', error.message);
    return { add: {}, remove: {} };
  }
}

/**
 * Загружает данные атрибутов из JSON файла
 */
async function loadAttributesData() {
  try {
    const data = await fs.readFile(ATTRIBUTES_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Ошибка загрузки данных атрибутов:', error.message);
    throw error;
  }
}

/**
 * Извлекает все уникальные слова из названий атрибутов
 * Фильтрует слова, которые содержат другие более короткие слова как подстроку
 * Учитывает регистр: только если подстрока начинается с той же буквы (с учетом регистра)
 */
function extractUniqueWordsFromAttributes(attributesData) {
  const words = new Set();
  
  // Получаем все атрибуты из данных
  const attributes = attributesData.attributes_power.attributes;
  
  // Собираем все уникальные слова, начинающиеся с заглавной буквы
  for (const category in attributes) {
    const categoryAttributes = attributes[category];
    
    for (const attributeName in categoryAttributes) {
      const attributeWords = attributeName.split(' ');
      
      attributeWords.forEach(word => {
        if (word && word.length > 0 && /^[A-Z]/.test(word)) {
          words.add(word);
        }
      });
    }
  }
  
  // Преобразуем в массив и сортируем по длине (от коротких к длинным)
  const allWords = Array.from(words);
  allWords.sort((a, b) => a.length - b.length);
  
  // Массив для отфильтрованных слов (только базовые формы)
  const filteredWords = [];
  
  // Проходим по всем словам от коротких к длинным
  for (let i = 0; i < allWords.length; i++) {
    const currentWord = allWords[i];
    let isDerived = false;
    
    // Проверяем, не является ли текущее слово производным от уже добавленных
    for (const existingWord of filteredWords) {
      // Сравниваем с учетом регистра!
      // Важно: "Old" не содержит "Gold" потому что 'O' != 'G'
      
      // Если текущее слово начинается с существующего слова
      // И разница в длине небольшая (1-3 символа)
      if (currentWord.startsWith(existingWord) && 
          currentWord !== existingWord) {
        
        const lengthDiff = currentWord.length - existingWord.length;
        
        // Условие: текущее слово начинается с существующего слова
        // И разница в длине <= 3 символа
        if (lengthDiff <= 3) {
          isDerived = true;
          break;
        }
      }
    }
    
    // Если слово не является производным, добавляем его
    if (!isDerived) {
      filteredWords.push(currentWord);
    }
  }
  
  return filteredWords.sort();
}

/**
 * Создает карту синергий для каждого слова
 * Карта показывает, в каких атрибутах встречается каждое слово
 * Учитывает как точные совпадения, так и частичные вхождения
 */
function createSynergyMap(attributesData, uniqueWords) {
  const synergyMap = {};
  
  // Получаем все атрибуты из данных
  const attributes = attributesData.attributes_power.attributes;
  
  // Инициализируем карту для каждого слова
  uniqueWords.forEach(word => {
    synergyMap[word] = [];
  });
  
  // Создаем оптимизированную структуру для поиска
  // Группируем слова по первой букве (с учетом регистра)
  const wordsByFirstLetter = {};
  uniqueWords.forEach(word => {
    const firstLetter = word[0];
    if (!wordsByFirstLetter[firstLetter]) {
      wordsByFirstLetter[firstLetter] = [];
    }
    wordsByFirstLetter[firstLetter].push(word);
  });
  
  // Собираем все названия атрибутов
  const allAttributeNames = [];
  for (const category in attributes) {
    const categoryAttributes = attributes[category];
    for (const attributeName in categoryAttributes) {
      allAttributeNames.push(attributeName);
    }
  }
  
  // Для каждого атрибута ищем входящие в него слова
  allAttributeNames.forEach(attributeName => {
    // Разбиваем название атрибута на слова
    const attributeWords = attributeName.split(' ');
    
    attributeWords.forEach(attrWord => {
      if (!attrWord || attrWord.length < 2) return;
      
      const firstLetter = attrWord[0];
      const possibleWords = wordsByFirstLetter[firstLetter];
      
      if (possibleWords) {
        // Проверяем каждое слово, начинающееся с той же буквы
        possibleWords.forEach(word => {
          // Проверяем вхождение слова в слово атрибута
          // Учитываем регистр!
          if (attrWord === word) {
            // Точное совпадение
            if (!synergyMap[word].includes(attributeName)) {
              synergyMap[word].push(attributeName);
            }
          } else if (attrWord.startsWith(word) && 
                     attrWord.length > word.length) {
            // Частичное вхождение (слово начинается с базового слова)
            // Например: attrWord="Golden" начинается с word="Gold"
            if (!synergyMap[word].includes(attributeName)) {
              synergyMap[word].push(attributeName);
            }
          }
        });
      }
    });
  });
  
  return synergyMap;
}

/**
 * Применяет исключения к карте синергий
 */
function applyExceptions(synergyMap, exceptions) {
  // Копируем карту синергий
  const resultMap = JSON.parse(JSON.stringify(synergyMap));
  
  // 1. Добавляем дополнительные атрибуты к синергиям
  for (const synergy in exceptions.add) {
    if (!resultMap[synergy]) {
      resultMap[synergy] = [];
    }
    
    const attributesToAdd = exceptions.add[synergy];
    attributesToAdd.forEach(attribute => {
      if (!resultMap[synergy].includes(attribute)) {
        resultMap[synergy].push(attribute);
      }
    });
  }
  
  // 2. Удаляем атрибуты из синергий
  for (const synergy in exceptions.remove) {
    if (resultMap[synergy]) {
      const attributesToRemove = exceptions.remove[synergy];
      
      resultMap[synergy] = resultMap[synergy].filter(attribute => 
        !attributesToRemove.includes(attribute)
      );
    }
  }
  
  // Фильтруем синергии: удаляем те, у которых только один атрибут
  const filteredMap = {};
  for (const word in resultMap) {
    if (resultMap[word].length > 1) {
      filteredMap[word] = resultMap[word];
    }
  }
  
  // Сортируем атрибуты для каждого слова
  for (const word in filteredMap) {
    filteredMap[word].sort();
  }
  
  return filteredMap;
}

/**
 * Создает текстовое представление карты синергий
 */
function createTextSynergyMap(synergyMap) {
  let textMap = '';
  
  // Сортируем слова для красивого вывода
  const sortedWords = Object.keys(synergyMap).sort();
  
  sortedWords.forEach(word => {
    const attributes = synergyMap[word];
    if (attributes.length > 0) {
      textMap += `${word} {${attributes.join(', ')}}\n`;
    }
    // Не выводим слова без атрибутов или с одним атрибутом
  });
  
  return textMap;
}

/**
 * Основная функция создания карты синергий
 */
async function createSynergyMapFile() {
  console.log('🔄 Начинаю создание карты синергий...');
  
  try {
    // 1. Загружаем данные атрибутов
    console.log('📥 Загружаю данные атрибутов...');
    const attributesData = await loadAttributesData();
    
    // 2. Загружаем исключения
    console.log('📥 Загружаю исключения...');
    const exceptions = await loadSynergyExceptions();
    console.log(`📊 Загружено исключений: add=${Object.keys(exceptions.add).length}, remove=${Object.keys(exceptions.remove).length}`);
    
    // 3. Извлекаем уникальные слова (с фильтрацией производных слов)
    console.log('🔍 Извлекаю уникальные слова из атрибутов...');
    const uniqueWords = extractUniqueWordsFromAttributes(attributesData);
    console.log(`📊 Найдено уникальных слов: ${uniqueWords.length}`);
    
    // 4. Создаем базовую карту синергий
    console.log('🗺️ Создаю карту синергий...');
    const baseSynergyMap = createSynergyMap(attributesData, uniqueWords);
    console.log(`📊 Базовая карта: ${Object.keys(baseSynergyMap).length} слов`);
    
    // 5. Применяем исключения
    console.log('⚙️ Применяю исключения...');
    const finalSynergyMap = applyExceptions(baseSynergyMap, exceptions);
    console.log(`📊 Финальная карта (с >1 атрибутом): ${Object.keys(finalSynergyMap).length} синергий`);
    
    // 6. Создаем текстовое представление
    console.log('📝 Формирую текстовое представление...');
    const textSynergyMap = createTextSynergyMap(finalSynergyMap);
    
    // 7. Сохраняем в JSON файл
    console.log('💾 Сохраняю JSON файл...');
    await fs.writeFile(
      SYNERGY_MAP_FILE, 
      JSON.stringify(finalSynergyMap, null, 2), 
      'utf8'
    );
    
    // 8. Сохраняем текстовый файл
    const textFilePath = SYNERGY_MAP_FILE.replace('.json', '.txt');
    await fs.writeFile(textFilePath, textSynergyMap, 'utf8');
    
    console.log('✅ Карта синергий успешно создана!');
    console.log(`📁 JSON файл: ${SYNERGY_MAP_FILE}`);
    console.log(`📁 Текстовый файл: ${textFilePath}`);
    
    // Показываем примененные исключения
    console.log('\n📋 Примененные исключения:');
    for (const synergy in exceptions.add) {
      console.log(`  ➕ ${synergy}: добавлено ${exceptions.add[synergy].length} атрибутов`);
    }
    for (const synergy in exceptions.remove) {
      console.log(`  ➖ ${synergy}: удалено ${exceptions.remove[synergy].length} атрибутов`);
    }
    
    return {
      success: true,
      wordCount: uniqueWords.length,
      filteredWordCount: Object.keys(finalSynergyMap).length,
      jsonFile: SYNERGY_MAP_FILE,
      textFile: textFilePath,
      sample: textSynergyMap.split('\n').slice(0, 10).join('\n') // Первые 10 строк для примера
    };
    
  } catch (error) {
    console.error('❌ Ошибка создания карты синергий:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Функция для отображения статистики по карты синергий
 */
async function showSynergyMapStats() {
  try {
    const data = await fs.readFile(SYNERGY_MAP_FILE, 'utf8');
    const synergyMap = JSON.parse(data);
    
    const stats = {
      totalWords: Object.keys(synergyMap).length,
      totalAttributesMentions: Object.values(synergyMap).reduce((sum, arr) => sum + arr.length, 0)
    };
    
    // Рассчитываем среднее количество атрибутов на синергию
    stats.averageAttributesPerWord = stats.totalAttributesMentions / stats.totalWords;
    
    // Находим слова с наибольшим количеством атрибутов
    const sortedByCount = Object.entries(synergyMap)
      .map(([word, attributes]) => ({ word, count: attributes.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Находим слова с наименьшим количеством атрибутов (но >1)
    const sortedByCountAsc = Object.entries(synergyMap)
      .map(([word, attributes]) => ({ word, count: attributes.length }))
      .sort((a, b) => a.count - b.count)
      .slice(0, 10);
    
    return {
      success: true,
      stats,
      topWords: sortedByCount,
      bottomWords: sortedByCountAsc
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Команда для бота - создание карты синергий
 */
async function handleCreateSynergyMap(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    await bot.sendMessage(chatId, '🔄 Начинаю создание карты синергий...');
    
    const result = await createSynergyMapFile();
    
    if (result.success) {
      let message = `✅ *Карта синергий успешно создана!*\n\n`;
      message += `📊 *Статистика:*\n`;
      message += `• Изначально уникальных слов: ${result.wordCount}\n`;
      message += `• Синергий с >1 атрибутом: ${result.filteredWordCount}\n`;
      message += `• JSON файл: \`${path.basename(result.jsonFile)}\`\n`;
      message += `• Текстовый файл: \`${path.basename(result.textFile)}\`\n\n`;
      message += `📋 *Пример первых 10 записей:*\n`;
      message += `\`\`\`\n${result.sample}\n\`\`\``;
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
      // Отправляем статистику
      const statsResult = await showSynergyMapStats();
      if (statsResult.success) {
        let statsMessage = `📈 *Детальная статистика карты синергий:*\n\n`;
        statsMessage += `• Всего синергий: ${statsResult.stats.totalWords}\n`;
        statsMessage += `• Всего упоминаний атрибутов: ${statsResult.stats.totalAttributesMentions}\n`;
        statsMessage += `• Среднее атрибутов на синергию: ${statsResult.stats.averageAttributesPerWord.toFixed(2)}\n\n`;
        
        statsMessage += `🏆 *Топ-10 синергий по количеству атрибутов:*\n`;
        statsResult.topWords.forEach((item, index) => {
          statsMessage += `${index + 1}. *${item.word}* - ${item.count} атрибутов\n`;
        });
        
        await bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
      }
    } else {
      await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка в команде создания карты синергий:', error);
    await bot.sendMessage(chatId, `❌ Произошла ошибка: ${error.message}`);
  }
}

/**
 * Команда для бота - показать статистику карты синергий
 */
async function handleShowSynergyStats(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    const result = await showSynergyMapStats();
    
    if (result.success) {
      let message = `📈 *Статистика карты синергий:*\n\n`;
      message += `• Всего синергий: ${result.stats.totalWords}\n`;
      message += `• Всего упоминаний атрибутов: ${result.stats.totalAttributesMentions}\n`;
      message += `• Среднее атрибутов на синергию: ${result.stats.averageAttributesPerWord.toFixed(2)}\n\n`;
      
      message += `🏆 *Топ-10 синергий по количеству атрибутов:*\n`;
      result.topWords.forEach((item, index) => {
        message += `${index + 1}. *${item.word}* - ${item.count} атрибутов\n`;
      });
      
      message += `\n📊 *Синергии с минимальным количеством атрибутов:*\n`;
      result.bottomWords.forEach((item, index) => {
        if (index < 5) {
          message += `${index + 1}. *${item.word}* - ${item.count} атрибута\n`;
        }
      });
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, 
        `❌ Карта синергий не найдена. Сначала создайте её с помощью /create_synergy_map`
      );
    }
    
  } catch (error) {
    console.error('❌ Ошибка показа статистики карты синергий:', error);
    await bot.sendMessage(chatId, `❌ Произошла ошибка: ${error.message}`);
  }
}

// Экспорт функций
module.exports = {
  createSynergyMapFile,
  showSynergyMapStats,
  handleCreateSynergyMap,
  handleShowSynergyStats
};