require('dotenv').config();
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// ====== КОНФИГУРАЦИОННЫЕ ПЕРЕМЕННЫЕ ======
const API_TOKEN = process.env.API_TOKEN;
const TONAPI_KEY = process.env.TONAPI_KEY;
const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
const APP_URL = process.env.APP_URL;
const BOT_USERNAME = process.env.BOT_USERNAME;
const SESSION_SECRET = process.env.SESSION_SECRET;

// Адреса коллекций
const COLLECTION_ADDRESS_TONAPI = '0:463685d77d0474ec774386d92622ed688d34f07230741211d838c487dcfeec64';
const COLLECTION_ADDRESS_UF = 'EQBGNoXXfQR07HdDhtkmIu1ojTTwcjB0EhHYOMSH3P7sZGJR';

// Общие константы
const IMG_WIDTH = 350;

// Пути к файлам
const DATA_DIR = path.join(__dirname, '../nft_data');
const MAIN_DATA_FILE = path.join(DATA_DIR, 'all_nft_info.json');
const COLLECT_DATA_FILE = path.join(DATA_DIR, 'all_nft_info_collected.json');
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
    await sleep(300);
    const response = await axios.get(url, { headers, timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error('TonCenter request error:', error.response?.status, error.message);
    throw error;
  }
}

/**
 * Отправляет изображение в Telegram с изменением размера
 */
async function sendPhotoResized(bot, chatId, url, caption) {
  try {
    if (!url) throw new Error('Нет картинки');

    if (url.startsWith('ipfs://')) {
      url = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const resizedBuffer = await sharp(buffer)
      .resize({ width: IMG_WIDTH })
      .toBuffer();

    await bot.sendPhoto(chatId, resizedBuffer, { 
      caption: caption.slice(0, 1024),
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('Ошибка при отправке NFT:', err.message);
    await bot.sendMessage(chatId, caption + '\n(не удалось отправить картинку)', {
      parse_mode: 'Markdown'
    });
  }
}

/**
 * Форматирует дату в читаемый вид
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
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Экранирует специальные символы для Markdown
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Безопасное форматирование без Markdown
 */
function safeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*/g, '×')
    .replace(/_/g, '−')
    .replace(/`/g, '"')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')');
}

/**
 * Обрезает длинный текст
 */
function truncateText(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Форматирует атрибуты NFT для отображения
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
  
  while (lines.length < 2) {
    lines.push('');
  }
  
  return lines.slice(0, 2);
}

// ====== ФУНКЦИИ ДЛЯ СОЗДАНИЯ КАРТОЧЕК NFT ======

/**
 * Создает карточку NFT в формате Markdown
 */
function createNftCard(nft, index, total) {
  const attributesLines = formatAttributes(nft.attributes);
  const nftName = escapeMarkdown(nft.name || `NFT #${nft.nft_index || index}`);
  
  const topBorder = '┏' + '━'.repeat(38) + '┓';
  const bottomBorder = '┗' + '━'.repeat(38) + '┛';
  const sideBorder = '┃';
  
  const cardNumber = total > 1 ? `🎴 *Карточка ${index + 1} из ${total}*` : '🎴 *Карточка NFT*';
  
  let card = `${topBorder}\n`;
  card += `${sideBorder} ${cardNumber} ${sideBorder}\n`;
  card += `${sideBorder}                                          ${sideBorder}\n`;
  card += `${sideBorder} *${nftName}* ${sideBorder}\n`;
  card += `${sideBorder}                                          ${sideBorder}\n`;
  
  if (nft.image_url) {
    card += `${sideBorder} 🖼️ [Изображение](${nft.image_url}) ${sideBorder}\n`;
  } else {
    card += `${sideBorder} 🖼️ Нет изображения ${sideBorder}\n`;
  }
  
  card += `${sideBorder}                                          ${sideBorder}\n`;
  
  if (attributesLines[0]) {
    card += `${sideBorder} ${attributesLines[0]} ${sideBorder}\n`;
  }
  if (attributesLines[1]) {
    card += `${sideBorder} ${attributesLines[1]} ${sideBorder}\n`;
  }
  
  card += `${sideBorder}                                          ${sideBorder}\n`;
  
  if (nft.getgems_url) {
    card += `${sideBorder} [На GetGems](${nft.getgems_url}) ${sideBorder}\n`;
  }
  if (nft.owner_url) {
    card += `${sideBorder} [Владелец](${nft.owner_url}) ${sideBorder}\n`;
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
    
    const url = `https://toncenter.com/api/v3/nft/items?collection_address=${COLLECTION_ADDRESS_TONAPI}&limit=1&offset=0`;
    const data = await makeTonCenterRequest(url);
    
    if (data.collection && data.collection.next_item_index) {
      const totalCount = parseInt(data.collection.next_item_index);
      console.log(`📊 Всего NFT: ${totalCount}`);
      return totalCount;
    }
    
    console.error('❌ Не удалось найти next_item_index в ответе API');
    return 0;
  } catch (error) {
    console.error('❌ Ошибка получения количества NFT:', error.message);
    return 0;
  }
}

// ====== ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ СБОРОМ ======

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
    console.error('❌ Ошибка сохранения состояния:', error.message);
    return { success: false, error: error.message };
  }
}

async function loadCollectionState() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(COLLECTION_STATE_FILE, 'utf8');
    return { success: true, state: JSON.parse(data) };
  } catch (error) {
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
    console.error('❌ Ошибка сохранения прогресса:', error.message);
    return { success: false, error: error.message };
  }
}

async function loadCollectionProgress() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(COLLECTION_PROGRESS_FILE, 'utf8');
    return { success: true, progress: JSON.parse(data) };
  } catch (error) {
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

async function clearCollectionState() {
  try {
    await ensureDataDir();
    try { await fs.unlink(COLLECTION_STATE_FILE); } catch (err) {}
    try { await fs.unlink(COLLECTION_PROGRESS_FILE); } catch (err) {}
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка очистки состояния:', error.message);
    return { success: false, error: error.message };
  }
}

// ====== ФУНКЦИИ ПРОВЕРКИ ======

function checkApiKeys() {
  const results = {
    telegram: !!API_TOKEN,
    tonapi: !!TONAPI_KEY,
    toncenter: !!TONCENTER_API_KEY
  };
  
  return {
    ...results,
    allSet: results.telegram && results.tonapi && results.toncenter
  };
}

// ====== ЭКСПОРТ ======
module.exports = {
  // Конфигурация
  API_TOKEN,
  TONAPI_KEY,
  TONCENTER_API_KEY,
  APP_URL,
  BOT_USERNAME,
  SESSION_SECRET,
  COLLECTION_ADDRESS_TONAPI,
  COLLECTION_ADDRESS_UF,
  
  // Общие константы
  IMG_WIDTH,
  
  // Пути к файлам
  DATA_DIR,
  MAIN_DATA_FILE,
  COLLECT_DATA_FILE,
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
  
  // Функции для создания карточек
  createNftCard,

  // Функции для управления сбором
  getTotalNftCount,
  saveCollectionState,
  loadCollectionState,
  saveCollectionProgress,
  loadCollectionProgress,
  clearCollectionState,
  
  // Функции проверки
  checkApiKeys
};