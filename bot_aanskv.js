const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статических файлов из папки public
app.use(express.static('public'));

// Health check для Render
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html'); // ← Отдаем index.html
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'martian-bot'
  });
});

// Запускаем сервер
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP сервер запущен на порту ${PORT}`);
});

const { API_TOKEN } = require('./modules/utils.js');
const TelegramBot = require('node-telegram-bot-api');

// Импорт модулей команд
const { 
  handleCreateSynergyMap,
  handleShowSynergyStats 
} = require('./modules/createSynergyMap.js');

// ====== BOT INIT ======
const bot = new TelegramBot(API_TOKEN, { polling: true });

// ====== ФУНКЦИЯ ПРИВЕТСТВИЯ ПРИ ЗАПУСКЕ ======
async function sendStartupGreeting() {
  try {
    const botInfo = await bot.getMe();
    console.log(`🤖 Бот ${botInfo.first_name} (@${botInfo.username}) запущен!`);
    console.log(`💡 Отправьте /start боту в Telegram, чтобы начать работу`);
    console.log(`🔗 Ссылка на бота: https://t.me/${botInfo.username}`);
  } catch (error) {
    console.error('❌ Ошибка при запуске:', error);
  }
}

// ====== РЕГИСТРАЦИЯ КОМАНД ======

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

bot.onText(/^\/login$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    try {
        // Берем URL из .env!
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
        
        console.log(`🔑 Пользователь @${user.username || user.id} открыл Web App: ${appUrl}`);
        
    } catch (error) {
        console.error('Ошибка в команде /login:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
});

// ====== КОМАНДА /login - Telegram Web App ======
bot.onText(/^\/login$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    try {
        const appUrl = 'https://jhf7cu.instatunnel.my'; // Ваш URL от InstaTunnel
        
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

// ====== ОБРАБОТКА ОШИБОК ======
bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 409) {
    console.log('⚠️ Бот уже запущен в другом месте');
  } else {
    console.error('❌ Polling error:', error);
  }
});

// ====== ЗАПУСК БОТА ======
async function startBot() {
  console.log('🤖 Запуск бота annskv...');
  
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