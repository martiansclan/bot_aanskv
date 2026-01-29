require('dotenv').config();
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// ====== КОНФИГУРАЦИОННЫЕ ПЕРЕМЕННЫЕ ======
const API_TOKEN = process.env.API_TOKEN;
const TONAPI_KEY = process.env.TONAPI_KEY;
const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;

// Адреса коллекций
const COLLECTION_ADDRESS_TONAPI =
  '0:463685d77d0474ec774386d92622ed688d34f07230741211d838c487dcfeec64';
const COLLECTION_ADDRESS_UF =
  'EQBGNoXXfQR07HdDhtkmIu1ojTTwcjB0EhHYOMSH3P7sZGJR';


// Общие константы
const IMG_WIDTH = 350;

// Пути к файлам
const DATA_DIR = path.join(__dirname, '../nft_data');
const MAIN_DATA_FILE = path.join(DATA_DIR, 'all_nft_info.json');
const COLLECT_DATA_FILE = path.join(DATA_DIR, 'all_nft_info_collected.json');
//const TEMP_DATA_FILE = path.join(DATA_DIR, 'temp_data.json');
// Пути к файлам состояния для фонового сбора информации
const COLLECTION_STATE_FILE = path.join(DATA_DIR, 'collection_state.json');
const COLLECTION_PROGRESS_FILE = path.join(DATA_DIR, 'collection_progress.json');

// ====== ФУНКЦИИ ДЛЯ РАБОТЫ С ФАЙЛАМИ ======

/**
 * Создает папку для данных если она не существует
 */
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch (err) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`📁 Создана папка для данных: ${DATA_DIR}`);
  }
}

/**
 * Получает список файлов в папке данных
 */
async function listDataFiles() {
  try {
    await ensureDataDir();
    
    const files = await fs.readdir(DATA_DIR);
    const fileStats = [];
    
    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      const stats = await fs.stat(filePath);
      const fileSize = (stats.size / 1024).toFixed(2);
      
      fileStats.push({
        name: file,
        size: fileSize + ' KB',
        modified: stats.mtime,
        isFile: stats.isFile()
      });
    }
    
    return { success: true, files: fileStats };
  } catch (error) {
    console.error('❌ Ошибка чтения файлов:', error.message);
    return { success: false, error: error.message };
  }
}

// ====== ОБЩИЕ ФУНКЦИИ ======

/**
 * Пауза в миллисекундах
 * @param {number} ms - время в миллисекундах
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Выполняет запрос к TonCenter API с авторизацией
 * @param {string} url - URL для запроса
 */
async function makeTonCenterRequest(url) {
  const headers = TONCENTER_API_KEY ? { 'X-API-Key': TONCENTER_API_KEY } : {};
  
  try {
    await sleep(300); // Задержка между запросами
    const response = await axios.get(url, { headers, timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error('TonCenter request error:', error.response?.status, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Отправляет изображение в Telegram с изменением размера
 * @param {Object} bot - экземпляр Telegram бота
 * @param {number} chatId - ID чата
 * @param {string} url - URL изображения
 * @param {string} caption - подпись к изображение
 */
async function sendPhotoResized(bot, chatId, url, caption) {
  try {
    if (!url) throw new Error('Нет картинки');

    // Конвертируем IPFS в HTTP
    if (url.startsWith('ipfs://')) {
      url = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Скачиваем картинку в память
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    // Меняем размер картинки
    const resizedBuffer = await sharp(buffer)
      .resize({ width: IMG_WIDTH })
      .toBuffer();

    // Отправляем в Telegram
    await bot.sendPhoto(chatId, resizedBuffer, { 
      caption: caption.slice(0, 1024),
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('Ошибка при отправке NFT:', caption, err.message);
    await bot.sendMessage(chatId, caption + '\n(не удалось отправить картинку)', {
      parse_mode: 'Markdown'
    });
  }
}

/**
 * Форматирует дату в читаемый вид
 * @param {string|Date} date - дата для форматирования
 */
function formatDate(date) {
  if (!date) return 'Не указано';
  
  const d = new Date(date);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Форматирует размер файла
 * @param {number} bytes - размер в байтах
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Экранирует специальные символы для безопасного отображения в Markdown
 * @param {string} text - текст для экранирования
 */
function escapeMarkdown(text) {
  if (!text) return '';
  
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Более простая версия для избежания проблем с разметкой
 */
function safeMarkdown(text) {
  if (!text) return '';
  
  // Просто заменяем наиболее проблемные символы
  return text
    .replace(/\*/g, '×')  // Заменяем * на ×
    .replace(/_/g, '−')   // Заменяем _ на −
    .replace(/`/g, '"')   // Заменяем ` на "
    .replace(/\[/g, '(')  // Заменяем [ на (
    .replace(/\]/g, ')'); // Заменяем ] на )
}

/**
 * Обрезает длинный текст с добавлением многоточия
 * @param {string} text - текст для обрезки
 * @param {number} maxLength - максимальная длина
 */
function truncateText(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
}

/**
 * Форматирует атрибуты NFT для отображения в карточке
 * @param {Array} attributes - массив атрибутов NFT
 * @param {number} perLine - атрибутов в строке
 */
function formatAttributes(attributes, perLine = 2) {
  if (!attributes || !Array.isArray(attributes) || attributes.length === 0) {
    return ['Нет атрибутов', ''];
  }
  
  const lines = [];
  for (let i = 0; i < attributes.length; i += perLine) {
    const lineAttributes = attributes.slice(i, i + perLine);
    const lineText = lineAttributes
      .map(attr => {
        const value = truncateText(attr.value, 15);
        return `• ${attr.trait_type}: *${value}*`;
      })
      .join('    ');
    lines.push(lineText);
  }
  
  // Если строк меньше 2, добавляем пустые
  while (lines.length < 2) {
    lines.push('');
  }
  
  return lines.slice(0, 2);
}

// ====== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ СПИСКА КОМАНД ======

function getCommandList() {
  return [  
    {
      command: '/show_cards [число]',
      description: 'Показать карточки NFT',
      details: 'Красивые карточки в рамках с атрибутами и ссылками'
    }, 
    {
      command: '/stats',
      description: 'Показать статистику базы данных',
      details: 'Количество записей, уникальных NFT, размер файла и т.д.'
    },
    {
      command: '/help',
      description: 'Полная справка по командам',
      details: 'Подробное описание всех функций бота'
    },
    {
      command: '/start',
      description: 'Приветственное сообщение',
      details: 'Информация для начала работы с ботом'
    },
    {
      command: '/start_collect',
      description: 'Начать сбор ВСЕХ NFT коллекции',
      details: 'Запускает фоновый сбор всех NFT из коллекции'
    },
    {
      command: '/stop_collect',
      description: 'Остановить сбор NFT',
      details: 'Останавливает фоновый сбор данных'
    },    
    {
      command: '/collect_status',
      description: 'Статус сбора данных',
      details: 'Показывает прогресс сбора NFT'
    }
  ];
}

/**
 * Генерирует текст помощи на основе списка команд
 */
function generateHelpText() {
  const commands = getCommandList();
  let text = '🤖 *Martian NFT Bot - Список команд*\n\n';
  
  commands.forEach(cmd => {
    text += `*${cmd.command}*\n`;
    text += `${cmd.description}\n`;
    if (cmd.details) {
      text += `_${cmd.details}_\n`;
    }
    text += '\n';
  });
  
  text += `\n*Техническая информация:*\n`;
  text += `• Коллекция: \`${COLLECTION_ADDRESS_UF}\`\n`;
  text += `• Файл данных: \`nft_data/all_nft_info.json\`\n`;
  text += `• Лимит NFT за запрос: 10\n`;
  
  return text;
}

// ====== ФУНКЦИИ ДЛЯ ПРОВЕРКИ API КЛЮЧЕЙ ======

function checkApiKeys() {
  const results = {
    telegram: !!API_TOKEN,
    tonapi: !!TONAPI_KEY,
    toncenter: !!TONCENTER_API_KEY
  };
  
  const missing = [];
  if (!results.telegram) missing.push('Telegram Bot Token');
  if (!results.tonapi) missing.push('TON API Key');
  if (!results.toncenter) missing.push('TonCenter API Key');
  
  return {
    ...results,
    allSet: results.telegram && results.tonapi && results.toncenter,
    missing: missing.length > 0 ? missing.join(', ') : null
  };
}

// ====== ФУНКЦИИ ДЛЯ СОЗДАНИЯ КАРТОЧЕК NFT ======

/**
 * Создает карточку NFT в формате Markdown с рамкой
 * @param {Object} nft - данные NFT
 * @param {number} index - индекс карточки
 * @param {number} total - всего карточек
 */
function createNftCard(nft, index, total) {
  const attributesLines = formatAttributes(nft.attributes);
  const nftName = escapeMarkdown(nft.name || `NFT #${nft.nft_index || index}`);
  
  // Формируем рамку вокруг карточки
  const topBorder = '┏' + '━'.repeat(38) + '┓';
  const bottomBorder = '┗' + '━'.repeat(38) + '┛';
  const sideBorder = '┃';
  
  const cardNumber = total > 1 ? `🎴 *Карточка ${index + 1} из ${total}*` : '🎴 *Карточка NFT*';
  
  // Формируем карточку
  let card = `${topBorder}\n`;
  card += `${sideBorder} ${cardNumber} ${sideBorder}\n`;
  card += `${sideBorder}                                          ${sideBorder}\n`;
  card += `${sideBorder} *${nftName}* ${sideBorder}\n`;
  card += `${sideBorder}                                          ${sideBorder}\n`;
  
  // Если есть изображение, добавляем иконку картинки
  if (nft.image_url) {
    card += `${sideBorder} 🖼️ [Изображение](${nft.image_url}) ${sideBorder}\n`;
  } else {
    card += `${sideBorder} 🖼️ Нет изображения ${sideBorder}\n`;
  }
  
  card += `${sideBorder}                                          ${sideBorder}\n`;
  
  // Атрибуты
  if (attributesLines[0]) {
    card += `${sideBorder} ${attributesLines[0]} ${sideBorder}\n`;
  }
  
  if (attributesLines[1]) {
    card += `${sideBorder} ${attributesLines[1]} ${sideBorder}\n`;
  }
  
  card += `${sideBorder}                                          ${sideBorder}\n`;
  
  // Ссылки
  if (nft.getgems_url) {
    const gemsLink = `[На GetGems](${nft.getgems_url})`;
    card += `${sideBorder} ${gemsLink} ${sideBorder}\n`;
  }
  
  if (nft.owner_url) {
    const ownerLink = `[Владелец](${nft.owner_url})`;
    card += `${sideBorder} ${ownerLink} ${sideBorder}\n`;
  }
  
  card += `${sideBorder}                                          ${sideBorder}\n`;
  card += `${sideBorder} 🆔 \`${truncateText(nft.address, 30)}\` ${sideBorder}\n`;
  
  if (nft.on_sale !== undefined) {
    const saleStatus = nft.on_sale ? '💰 *На продаже*' : '📦 Не продается';
    card += `${sideBorder} ${saleStatus} ${sideBorder}\n`;
  }
  
  card += `${bottomBorder}`;
  
  return card;
}

/**
 * Получает общее количество NFT в коллекции
 */
async function getTotalNftCount() {
  try {
    console.log('🔄 Получаю общее количество NFT...');
    console.log('📡 Адрес коллекции (TONAPI):', COLLECTION_ADDRESS_TONAPI);
    
    // Используем TONAPI формат адреса для этого запроса
    const url = `https://toncenter.com/api/v3/nft/items?collection_address=${COLLECTION_ADDRESS_TONAPI}&limit=1&offset=0`;
    console.log('🔗 Запрос:', url);
    
    const data = await makeTonCenterRequest(url);
    console.log('✅ Получен ответ от API');
    
    // Отладка: посмотрим структуру ответа
    console.log('📋 Ключи в ответе:', Object.keys(data));
    
    // Проверяем наличие collection и next_item_index
    if (data.collection && data.collection.next_item_index) {
      const totalCount = parseInt(data.collection.next_item_index);
      console.log(`📊 Общее количество NFT в коллекции: ${totalCount}`);
      return totalCount;
    }
    
    // Альтернативный вариант
    if (data.nft_items && data.nft_items.length > 0) {
      const firstItem = data.nft_items[0];
      if (firstItem.collection && firstItem.collection.next_item_index) {
        const totalCount = parseInt(firstItem.collection.next_item_index);
        console.log(`📊 Общее количество NFT (из первого элемента): ${totalCount}`);
        return totalCount;
      }
    }
    
    console.error('❌ Не удалось найти next_item_index в ответе API');
    console.error('📄 Ответ API (первые 500 символов):', JSON.stringify(data).substring(0, 500));
    
    return 0;
    
  } catch (error) {
    console.error('❌ Ошибка получения общего количества NFT:');
    console.error('Сообщение:', error.message);
    
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', JSON.stringify(error.response.data).substring(0, 300));
    }
    
    return 0;
  }
}

/**
 * Сохраняет состояние сбора данных
 */
async function saveCollectionState(state) {
  try {
    await ensureDataDir();
    const stateWithTimestamp = {
      ...state,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(COLLECTION_STATE_FILE, JSON.stringify(stateWithTimestamp, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка сохранения состояния сбора:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Загружает состояние сбора данных
 */
async function loadCollectionState() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(COLLECTION_STATE_FILE, 'utf8');
    return { success: true, state: JSON.parse(data) };
  } catch (error) {
    // Если файла нет, возвращаем начальное состояние
    return { 
      success: true, 
      state: {
        isCollecting: false,
        isPaused: false,
        totalNfts: 0,
        processed: 0,
        batchSize: 100,
        lastOffset: 0,
        startTime: null,
        endTime: null
      }
    };
  }
}

/**
 * Сохраняет прогресс сбора для конкретной сессии
 */
async function saveCollectionProgress(progress) {
  try {
    await ensureDataDir();
    const progressWithTimestamp = {
      ...progress,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(COLLECTION_PROGRESS_FILE, JSON.stringify(progressWithTimestamp, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка сохранения прогресс:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Загружает прогресс сбора
 */
async function loadCollectionProgress() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(COLLECTION_PROGRESS_FILE, 'utf8');
    return { success: true, progress: JSON.parse(data) };
  } catch (error) {
    // Если файла нет, возвращаем пустой прогресс
    return { 
      success: true, 
      progress: {
        currentBatch: 0,
        totalBatches: 0,
        processedNfts: [],
        errors: [],
        startTime: null
      }
    };
  }
}

/**
 * Очищает состояние и прогресс сбора
 */
async function clearCollectionState() {
  try {
    await ensureDataDir();
    
    // Удаляем файлы состояния если они существуют
    try {
      await fs.unlink(COLLECTION_STATE_FILE);
    } catch (err) { /* файла нет */ }
    
    try {
      await fs.unlink(COLLECTION_PROGRESS_FILE);
    } catch (err) { /* файла нет */ }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка очистки состояния сбора:', error.message);
    return { success: false, error: error.message };
  }
}

// ====== ЭКСПОРТ ======
module.exports = {
  // Конфигурация
  API_TOKEN,
  TONAPI_KEY,
  TONCENTER_API_KEY,
  COLLECTION_ADDRESS_TONAPI,
  COLLECTION_ADDRESS_UF,
  
  // Общие константы
  IMG_WIDTH,
  
  // Пути к файлам
  DATA_DIR,
  MAIN_DATA_FILE,
  COLLECT_DATA_FILE,
  //TEMP_DATA_FILE,
  COLLECTION_STATE_FILE,
  COLLECTION_PROGRESS_FILE,
  
  // Функции для работы с файлами
  ensureDataDir, 
  listDataFiles,
  
  
  // Общие функции
  sleep,
  makeTonCenterRequest,
  sendPhotoResized,
  formatDate,
  formatFileSize,
  escapeMarkdown,
  safeMarkdown,
  truncateText,
  formatAttributes,
  
  // Функции для команд и помощи
  getCommandList,
  generateHelpText,
  
  // Функции проверки
  checkApiKeys,
  
  // Функции для создания карточек
  createNftCard,

  // Новые функции для управления сбором
  getTotalNftCount,
  saveCollectionState,
  loadCollectionState,
  saveCollectionProgress,
  loadCollectionProgress,
  clearCollectionState
};