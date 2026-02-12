// app/modules/bot/bot.service.js
require('dotenv').config();
const { 
    API_TOKEN,
    APP_URL
} = require('../../../modules/utils.js');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// Импорт модулей команд
const { 
    handleCreateSynergyMap,
    handleShowSynergyStats 
} = require('../../../modules/createSynergyMap.js');

class BotService {
    constructor() {
        this.bot = null;
        this.initialized = false;
        this.isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    }

    async initialize() {
        console.log('🤖 Инициализация Telegram бота...');

        try {
            if (this.isProduction) {
                // PRODUCTION: Webhook режим
                this.bot = new TelegramBot(API_TOKEN);
                const webhookUrl = `${APP_URL}/webhook/${API_TOKEN}`;
                
                await this.bot.setWebHook(webhookUrl);
                console.log('✅ Webhook установлен:', webhookUrl);
                
            } else {
                // DEVELOPMENT: Polling режим
                this.bot = new TelegramBot(API_TOKEN, { polling: true });
                console.log('📡 Запущен polling режим (локально)');
            }

            // Регистрируем команды
            this.registerCommands();
            
            // Получаем информацию о боте
            const botInfo = await this.bot.getMe();
            console.log(`🤖 Бот ${botInfo.first_name} (@${botInfo.username}) запущен!`);
            console.log(`🌐 Режим: ${this.isProduction ? 'WEBHOOK' : 'POLLING'}`);
            console.log(`🔗 Ссылка: https://t.me/${botInfo.username}`);
            
            this.initialized = true;
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации бота:', error);
            return false;
        }
    }

    registerCommands() {
        if (!this.bot) return;

        // Реакция на нового мембера
        this.bot.on('new_chat_members', async (msg) => {
            const chatId = msg.chat.id;
            for (const user of msg.new_chat_members) {
                const name = user.first_name || 'новичок';
                const gif = path.join(__dirname, '../../../public/image/greeting.mp4');
                try {
                    await this.bot.sendAnimation(chatId, gif);
                    await this.bot.sendMessage(chatId, `Приветствуем, ${name}!\nДобро пожаловать в клан Martian!`);
                } catch (err) {
                    console.log('Ошибка отправки приветствия:', err.description || err.message);
                }
            }
        });

        // Функция проверки ссылок
        const containsLink = (text) => {
            const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
            return linkRegex.test(text);
        };

        // Удаление ссылок
        this.bot.on('message', (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text || '';
            if (containsLink(text)) {
                this.bot.deleteMessage(chatId, msg.message_id).catch(err => console.log(err));
                this.bot.sendMessage(chatId, `⚠️ Ссылки запрещены!`).catch(err => console.log(err));
            }
        });

        // ====== КОМАНДА /start ======
        this.bot.onText(/^\/start$/, (msg) => {
            const chatId = msg.chat.id;
            const userName = msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || 'Пользователь');
            
            const startText = `🎉 Привет, ${userName}!
Добро пожаловать в Martian NFT Bot!

📊 Доступные команды:
👉 /login - открыть приложение в Telegram
👉 /me - информация о вашем аккаунте
👉 /help - полная справка

🌐 Открыть приложение: ${APP_URL}`;

            this.bot.sendMessage(chatId, startText, {
                parse_mode: undefined,
                disable_web_page_preview: true
            }).catch(err => console.error('Ошибка отправки /start:', err));
        });

        // ====== КОМАНДА /login ======
        this.bot.onText(/^\/login$/, async (msg) => {
            const chatId = msg.chat.id;
            const user = msg.from;
            
            try {
                const webAppUrl = `${APP_URL}?telegram_id=${user.id}&first_name=${encodeURIComponent(user.first_name || '')}&username=${encodeURIComponent(user.username || '')}`;
                
                await this.bot.sendMessage(chatId, 
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
                this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
            }
        });

        // ====== КОМАНДА /me ======
        this.bot.onText(/^\/me$/, async (msg) => {
            const chatId = msg.chat.id;
            const user = msg.from;
            
            await this.bot.sendMessage(chatId,
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
        this.bot.onText(/^\/help$/, (msg) => {
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

            this.bot.sendMessage(chatId, helpText, { 
                parse_mode: undefined,
                disable_web_page_preview: true 
            });
        });

        // ====== КОМАНДЫ ДЛЯ АДМИНИСТРАТОРОВ ======
        this.bot.onText(/\/create_synergy_map/, async (msg) => {
            try {
                await handleCreateSynergyMap(this.bot, msg);
            } catch (error) {
                console.error('Ошибка в команде /create_synergy_map:', error);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при создании карты синергий');
            }
        });

        this.bot.onText(/\/synergy_stats/, async (msg) => {
            try {
                await handleShowSynergyStats(this.bot, msg);
            } catch (error) {
                console.error('Ошибка в команде /synergy_stats:', error);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при получении статистики');
            }
        });

        console.log('📝 Команды бота зарегистрированы');
    }

    // Регистрация вебхука на Express приложении
    registerWebhook(app) {
        if (!this.bot || !this.isProduction) return;
        
        app.post(`/webhook/${API_TOKEN}`, (req, res) => {
            this.bot.processUpdate(req.body);
            res.sendStatus(200);
        });
        
        console.log(`🔗 Webhook endpoint: POST /webhook/${API_TOKEN}`);
    }

    async shutdown() {
        if (this.bot) {
            if (this.isProduction) {
                await this.bot.deleteWebHook();
            }
            this.bot.stopPolling();
            console.log('🛑 Бот остановлен');
        }
    }
}

module.exports = new BotService();