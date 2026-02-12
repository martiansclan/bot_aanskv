require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статических файлов
app.use(express.static('public'));

// Для парсинга JSON
app.use(express.json());

const { API_TOKEN } = require('./modules/utils.js');
const TelegramBot = require('node-telegram-bot-api');

// Импорт модулей команд
const { 
  handleCreateSynergyMap,
  handleShowSynergyStats 
} = require('./modules/createSynergyMap.js');

// ====== BOT INIT ======
let bot;

// Определяем окружение
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

if (isProduction) {
  // PRODUCTION: используем Webhook
  bot = new TelegramBot(API_TOKEN);
  const webhookUrl = `${process.env.APP_URL}/webhook/${API_TOKEN}`;
  
  bot.setWebHook(webhookUrl)
    .then(() => console.log('✅ Webhook установлен:', webhookUrl))
    .catch(err => console.error('❌ Ошибка установки webhook:', err));
  
  // Эндпоинт для вебхука
  app.post(`/webhook/${API_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
  
} else {
  // DEVELOPMENT: используем polling (только локально!)
  bot = new TelegramBot(API_TOKEN, { polling: true });
  console.log('📡 Запущен polling режим (локально)');
}

// ====== ФУНКЦИЯ ПРИВЕТСТВИЯ ПРИ ЗАПУСКЕ ======
async function sendStartupGreeting() {
  try {
    const botInfo = await bot.getMe();
    console.log(`🤖 Бот ${botInfo.first_name} (@${botInfo.username}) запущен!`);
    console.log(`🌐 Режим: ${isProduction ? 'WEBHOOK' : 'POLLING'}`);
    console.log(`🔗 Ссылка на бота: https://t.me/${botInfo.username}`);
  } catch (error) {
    console.error('❌ Ошибка при запуске:', error);
  }
}

// ====== ВСЕ ВАШИ КОМАНДЫ ЗДЕСЬ ======

// Реакция на нового мембера
bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;
  for (const user of msg.new_chat_members) {
    const name = user.first_name || 'новичок';
    const gif = './public/image/greeting.mp4';
    try {
      await bot.sendAnimation(chatId, gif);
      await bot.sendMessage(chatId, `Приветствуем, ${name}!\nДобро пожаловать в клан Martian!`);
    } catch (err) {
      console.log('Ошибка отправки приветствия:', err.description || err.message);
    }
  }
});

// Функция проверки наличия ссылок
function containsLink(text) {
  const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
  return linkRegex.test(text);
}

// Удаление ссылок
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  if (containsLink(text)) {
    bot.deleteMessage(chatId, msg.message_id).catch(err => console.log(err));
    bot.sendMessage(chatId, `⚠️ Ссылки запрещены!`).catch(err => console.log(err));
  }
});

// ====== КОМАНДА /start ======
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || 'Пользователь');
  
  const startText = `🎉 Привет, ${userName}!
Добро пожаловать в Martian NFT Bot!

📊 Доступные команды:
👉 /login - открыть приложение в Telegram
👉 /me - информация о вашем аккаунте
👉 /help - полная справка`;

  bot.sendMessage(chatId, startText, {
    parse_mode: undefined,
    disable_web_page_preview: true
  });
});

// ====== КОМАНДА /login - Telegram Web App ======
bot.onText(/^\/login$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    try {
        const appUrl = process.env.APP_URL || 'https://bot-aanskv.onrender.com';
        
        const webAppUrl = `${appUrl}?telegram_id=${user.id}&first_name=${encodeURIComponent(user.first_name || '')}&username=${encodeURIComponent(user.username || '')}`;
        
        await bot.sendMessage(chatId, 
            `🎮 Открыть Martian NFT Analyzer в Telegram\n\n` +
            `Привет, ${user.first_name || 'Пользователь'}!\n` +
            `Нажми на кнопку ниже, чтобы открыть приложение прямо в Telegram.`,
            {
                parse_mode: undefined,
                reply_markup: {
                    inline_keyboard: [
                        [{ 
                            text: '🚀 ЗАПУСТИТЬ ПРИЛОЖЕНИЕ', 
                            web_app: { url: webAppUrl }
                        }]
                    ]
                }
            }
        );
        
        console.log(`🔑 Пользователь @${user.username || user.id} открыл Web App`);
        
    } catch (error) {
        console.error('Ошибка в команде /login:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
});

// ====== КОМАНДА /me ======
bot.onText(/^\/me$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    await bot.sendMessage(chatId,
        `👤 Информация о пользователе\n\n` +
        `ID: ${user.id}\n` +
        `Имя: ${user.first_name || 'Не указано'}\n` +
        `Фамилия: ${user.last_name || 'Не указана'}\n` +
        `Username: ${user.username ? '@' + user.username : 'Не указан'}\n` +
        `Язык: ${user.language_code || 'ru'}`,
        { parse_mode: undefined }
    );
});

// ====== КОМАНДА /help ======
bot.onText(/^\/help$/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🤖 Martian NFT Bot - Справка

Основные команды:
👉 /login - открыть приложение в Telegram
👉 /me - информация о вашем аккаунте
👉 /start - начальное приветствие
👉 /help - эта справка

Веб-приложение:
После нажатия на кнопку в /login приложение откроется прямо в Telegram!`;

  bot.sendMessage(chatId, helpText, { 
    parse_mode: undefined,
    disable_web_page_preview: true 
  });
});

// ====== ЗАПУСК СЕРВЕРА ======
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP сервер запущен на порту ${PORT}`);
  if (isProduction) {
    console.log(`🔗 Webhook URL: ${process.env.APP_URL}/webhook/${API_TOKEN}`);
  }
});

// ====== ЗАПУСК БОТА ======
async function startBot() {
  try {
    const { ensureDataDir } = require('./modules/utils.js');
    await ensureDataDir();
    await sendStartupGreeting();
    console.log('✅ Бот успешно запущен!');
  } catch (error) {
    console.error('❌ Ошибка запуска бота:', error);
  }
}

startBot();