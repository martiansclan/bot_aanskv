require('dotenv').config();
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const sharp = require('sharp');

// ====== CONFIG ======
const API_TOKEN = process.env.API_TOKEN;
const TONAPI_KEY = process.env.TONAPI_KEY;

const COLLECTION_ADDRESS =
  '0:463685d77d0474ec774386d92622ed688d34f07230741211d838c487dcfeec64';

const LIMIT = 30;   // сколько последних NFT проверяем
const MAX_SEND = 5; // сколько NFT отправляем за раз
const IMG_WIDTH = 350; // ширина картинки в пикселях для Telegram

// ====== BOT ======
const bot = new TelegramBot(API_TOKEN, { polling: true });
console.log('🤖 Bot started');

// ====== FETCH LAST NFT ======
async function fetchLatestNfts(limit = LIMIT) {
  const url = `https://tonapi.io/v2/nfts/collections/${COLLECTION_ADDRESS}/items?limit=${limit}&offset=0`;

  try {
    const { data } = await axios.get(url, {
      headers: { 'X-API-Key': TONAPI_KEY },
    });

    return data.nft_items || [];
  } catch (err) {
    console.error('TON API error:', err.response?.status, err.message);
    return [];
  }
}

// ====== FILTER MARTIANS ======
function filterMartians(items) {
  return items.filter(item =>
    item.metadata?.attributes?.some(attr =>
      attr.trait_type === 'Skin Tone' && attr.value === 'Martian'
    )
  );
}

// ====== DOWNLOAD, RESIZE (PIXELS) AND SEND IMAGE ======
async function sendPhotoResized(chatId, url, caption) {
  try {
    if (!url) throw new Error('Нет картинки');

    // Конвертируем IPFS в HTTP
    if (url.startsWith('ipfs://')) {
      url = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Скачиваем картинку в память
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    // Меняем размер картинки в пикселях (ширина 300px, пропорции сохраняются)
    const resizedBuffer = await sharp(buffer)
      .resize({ width: IMG_WIDTH })
      .toBuffer();

    // Отправляем в Telegram
    await bot.sendPhoto(chatId, resizedBuffer, { caption: caption.slice(0, 1024) });
  } catch (err) {
    console.error('Ошибка при отправке NFT:', caption, err.message);
    await bot.sendMessage(chatId, caption + '\n(не удалось отправить картинку)');
  }
}

// ====== COMMAND /new_martian ======
bot.onText(/\/new_martian/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, '👽 Проверяю последние NFT...');

  const items = await fetchLatestNfts(LIMIT);
  const martians = filterMartians(items);

  if (!martians.length) {
    return bot.sendMessage(chatId, '🫤 Среди последних NFT Martian не найдено');
  }

  await bot.sendMessage(
    chatId,
    `🔥 Свежие Martian NFT: ${martians.length}. Показываю первые ${Math.min(
      martians.length,
      MAX_SEND
    )}`
  );

  for (const item of martians.slice(0, MAX_SEND)) {
    const nft = item.metadata;
    const caption = `👽 ${nft.name || 'No Name'}`;

    await sendPhotoResized(chatId, nft.image, caption);
  }
});
