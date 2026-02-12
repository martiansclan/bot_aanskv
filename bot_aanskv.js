require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// Раздача статических файлов
app.use(express.static('public'));

// Для парсинга JSON
app.use(express.json());

const { 
    API_TOKEN,
    APP_URL
} = require('./modules/utils.js');
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

// ====== ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ БОТА ======
async function initializeBot() {
    if (isProduction) {
        // PRODUCTION: используем Webhook
        bot = new TelegramBot(API_TOKEN);
        const webhookUrl = `${APP_URL}/webhook/${API_TOKEN}`;
        
        try {
            await bot.setWebHook(webhookUrl);
            console.log('✅ Webhook установлен:', webhookUrl);
        } catch (err) {
            console.error('❌ Ошибка установки webhook:', err);
            throw err;
        }
        
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
    
    return bot;
}

// ====== РЕГИСТРАЦИЯ ВСЕХ КОМАНД ======
function registerCommands(bot) {
    
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
👉 /help - полная справка

🌐 Открыть приложение: ${APP_URL}`;

        bot.sendMessage(chatId, startText, {
            parse_mode: undefined,
            disable_web_page_preview: true
        }).catch(err => console.error('Ошибка отправки /start:', err));
    });

    // ====== КОМАНДА /login - Telegram Web App ======
    bot.onText(/^\/login$/, async (msg) => {
        const chatId = msg.chat.id;
        const user = msg.from;
        
        try {
            const appUrl = APP_URL || 'https://bot-aanskv.onrender.com';
            
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
После нажатия на кнопку в /login приложение откроется прямо в Telegram!

🌐 Ссылка: ${APP_URL}`;

        bot.sendMessage(chatId, helpText, { 
            parse_mode: undefined,
            disable_web_page_preview: true 
        });
    });

    // ====== КОМАНДЫ ДЛЯ АДМИНИСТРАТОРОВ ======
    bot.onText(/\/create_synergy_map/, async (msg) => {
        try {
            await handleCreateSynergyMap(bot, msg);
        } catch (error) {
            console.error('Ошибка в команде /create_synergy_map:', error);
            bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при создании карты синергий');
        }
    });

    bot.onText(/\/synergy_stats/, async (msg) => {
        try {
            await handleShowSynergyStats(bot, msg);
        } catch (error) {
            console.error('Ошибка в команде /synergy_stats:', error);
            bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при получении статистики');
        }
    });

    console.log('📝 Команды бота зарегистрированы');
}

// ====== ФУНКЦИЯ ПРИВЕТСТВИЯ ПРИ ЗАПУСКЕ ======
async function sendStartupGreeting(bot) {
    try {
        const botInfo = await bot.getMe();
        console.log(`🤖 Бот ${botInfo.first_name} (@${botInfo.username}) запущен!`);
        console.log(`🌐 Режим: ${isProduction ? 'WEBHOOK' : 'POLLING'}`);
        console.log(`🔗 Ссылка на бота: https://t.me/${botInfo.username}`);
        console.log(`🌍 Web App URL: ${APP_URL}`);
    } catch (error) {
        console.error('❌ Ошибка при запуске:', error);
    }
}

// ====== ЗАПУСК СЕРВЕРА ======
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP сервер запущен на порту ${PORT}`);
});

// ====== ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА ======
async function startBot() {
    try {
        console.log('🤖 Запуск бота annskv...');
        
        // 1. Инициализируем бота
        await initializeBot();
        
        // 2. Регистрируем все команды
        registerCommands(bot);
        
        // 3. Создаем папку для данных
        const { ensureDataDir } = require('./modules/utils.js');
        await ensureDataDir();
        
        // 4. Отправляем приветствие
        await sendStartupGreeting(bot);
        
        console.log('✅ Бот успешно запущен!');
        
    } catch (error) {
        console.error('❌ Ошибка запуска бота:', error);
        process.exit(1);
    }
}

// Запускаем бота
startBot();

// Обработка ошибок
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});