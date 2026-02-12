// app/modules/bot/bot.service.js
require('dotenv').config();
const { 
    API_TOKEN,
    APP_URL
} = require('../../../modules/utils.js');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const express = require('express');

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
        this.app = null; // <-- ДОБАВЛЕНО: храним ссылку на Express app
        this.updateCount = 0;
        console.log(`🛠️ Режим работы бота: ${this.isProduction ? 'PRODUCTION (WEBHOOK)' : 'DEVELOPMENT (POLLING)'}`);
        console.log(`🔑 Токен бота: ${API_TOKEN ? '✅ Установлен' : '❌ НЕ УСТАНОВЛЕН'}`);
        console.log(`🌐 APP_URL: ${APP_URL ? '✅ Установлен' : '❌ НЕ УСТАНОВЛЕН'}`);
    }

    // <-- ДОБАВЛЕНО: метод для установки app после инициализации
    setApp(app) {
        this.app = app;
        console.log('🤖 Express app установлен в боте');
        
        // Если бот уже инициализирован и мы в production, регистрируем webhook
        if (this.initialized && this.isProduction && this.app) {
            this.registerWebhook(this.app);
            this.registerTestEndpoint(this.app);
            console.log('✅ Webhook endpoints зарегистрированы после установки app');
        }
    }

    incrementUpdateCount() {
        this.updateCount = (this.updateCount || 0) + 1;
        return this.updateCount;
    }
    
    async initialize(app) {
        console.log('\n🤖 ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА...');
        console.log('='.repeat(50));

        try {
            // Сохраняем app если передан
            if (app) {
                this.app = app;
                console.log('✅ Express app получен при инициализации');
            }

            // Проверка наличия токена
            if (!API_TOKEN) {
                throw new Error('API_TOKEN не найден в переменных окружения!');
            }

            // ОПРЕДЕЛЯЕМ РЕЖИМ РАБОТЫ
            const isRender = !!process.env.RENDER;
            this.isProduction = process.env.NODE_ENV === 'production' || isRender;
            
            console.log(`🛠️ Режим работы бота: ${this.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
            console.log(`🔍 Платформа: ${isRender ? 'Render.com' : 'Localhost'}`);
            console.log(`🔑 Токен бота: ${API_TOKEN ? '✅' : '❌'}`);
            console.log(`🌐 APP_URL: ${APP_URL ? '✅ ' + APP_URL : '❌ НЕ УСТАНОВЛЕН'}`);

            // PRODUCTION: Webhook режим (Render)
            if (this.isProduction) {
                if (!APP_URL) {
                    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: APP_URL не установлен!');
                    console.error('   На Render необходимо установить APP_URL в переменных окружения');
                    console.error('   Бот будет работать в режиме POLLING, но это НЕ РЕКОМЕНДУЕТСЯ');
                    
                    // Fallback на polling с предупреждением
                    console.log('📡 Временно используем POLLING режим...');
                    this.bot = new TelegramBot(API_TOKEN, { 
                        polling: true,
                        onlyFirstMatch: true
                    });
                    console.log('⚠️ POLLING на Render может работать нестабильно!');
                } else {
                    // Нормальный webhook режим
                    console.log('🌐 Настройка WEBHOOK режима...');
                    
                    this.bot = new TelegramBot(API_TOKEN);
                    console.log('✅ Экземпляр бота создан');

                    // Удаляем старый webhook
                    console.log('🧹 Удаление старого webhook...');
                    await this.bot.deleteWebHook();
                    console.log('✅ Старый webhook удален');

                    // Устанавливаем новый webhook
                    const webhookUrl = `${APP_URL}/webhook/${API_TOKEN}`;
                    console.log(`🔗 Установка нового webhook: ${webhookUrl}`);
                    
                    const result = await this.bot.setWebHook(webhookUrl);
                    
                    if (result) {
                        console.log('✅ Webhook успешно установлен!');
                    } else {
                        console.error('❌ Не удалось установить webhook');
                    }

                    // Проверяем статус webhook
                    const webhookInfo = await this.bot.getWebHookInfo();
                    console.log('\n📊 ИНФОРМАЦИЯ О WEBHOOK:');
                    console.log(`   URL: ${webhookInfo.url || 'не установлен'}`);
                    console.log(`   Ожидающих обновлений: ${webhookInfo.pending_update_count || 0}`);
                    
                    // Регистрируем webhook endpoint на Express
                    if (this.app) {
                       // this.registerWebhook(this.app);
                        this.registerTestEndpoint(this.app);
                        console.log('✅ Webhook endpoint зарегистрирован на Express');
                    }
                }
            } 
            // DEVELOPMENT: Polling режим (локально)
            else {
                console.log('📡 Настройка POLLING режима...');
                this.bot = new TelegramBot(API_TOKEN, { 
                    polling: true,
                    onlyFirstMatch: true,
                    request: { timeout: 30000 }
                });
                console.log('✅ Polling режим активирован');
                
                this.bot.on('polling_error', (error) => {
                    console.error('❌ Polling error:', error.message);
                });
            }

            // Регистрируем команды (общая часть)
            if (this.bot) {
                this.registerCommands();
                
                const botInfo = await this.bot.getMe();
                console.log('\n🤖 ИНФОРМАЦИЯ О БОТЕ:');
                console.log(`   Имя: ${botInfo.first_name}`);
                console.log(`   Username: @${botInfo.username}`);
                console.log(`   ID: ${botInfo.id}`);
                console.log(`   Режим: ${this.isProduction && APP_URL ? 'WEBHOOK' : 'POLLING'}`);
                console.log(`   Статус: ✅ АКТИВЕН`);
                
                this.initialized = true;
                console.log('✅ Бот успешно инициализирован!\n');
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА ИНИЦИАЛИЗАЦИИ БОТА:');
            console.error(`   ${error.message}`);
            console.error('='.repeat(50) + '\n');
            return false;
        }
    }

    registerRenderHealthCheck(app) {
        if (!app) return;
        
        // Health check для Render
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                bot: {
                    initialized: this.initialized,
                    mode: this.isProduction && APP_URL ? 'webhook' : 'polling',
                    hasBot: !!this.bot,
                    webhookUrl: this.bot ? `${APP_URL}/webhook/${API_TOKEN}` : null
                }
            });
        });
        
        app.get('/debug', async (req, res) => {
            try {
                const botInfo = this.bot ? await this.bot.getMe() : null;
                const webhookInfo = this.bot ? await this.bot.getWebHookInfo() : null;
                
                res.json({
                    environment: {
                        NODE_ENV: process.env.NODE_ENV,
                        RENDER: process.env.RENDER,
                        APP_URL: APP_URL,
                        PORT: process.env.PORT
                    },
                    bot: {
                        initialized: this.initialized,
                        exists: !!this.bot,
                        info: botInfo ? {
                            username: botInfo.username,
                            id: botInfo.id
                        } : null
                    },
                    webhook: webhookInfo ? {
                        url: webhookInfo.url,
                        pending: webhookInfo.pending_update_count,
                        last_error: webhookInfo.last_error_message
                    } : null
                });
            } catch (error) {
                res.json({ error: error.message });
            }
        });
    }

    registerCommands() {
        if (!this.bot) {
            console.log('❌ Невозможно зарегистрировать команды: бот не инициализирован');
            return;
        }

        console.log('📝 РЕГИСТРАЦИЯ КОМАНД БОТА...');

        // ===== ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ВСЕХ СООБЩЕНИЙ (ОТЛАДКА) =====
        this.bot.on('message', (msg) => {
            console.log('\n📨 ПОЛУЧЕНО СООБЩЕНИЕ:');
            console.log(`   Chat ID: ${msg.chat.id}`);
            console.log(`   От: @${msg.from?.username || 'нет'} (ID: ${msg.from?.id})`);
            console.log(`   Текст: ${msg.text || '[не текст]'}`);
            console.log(`   Тип: ${msg.chat.type}`);
            console.log(`   Время: ${new Date(msg.date * 1000).toLocaleString()}`);
        });

        // ===== ОБРАБОТЧИК ОШИБОК =====
        this.bot.on('error', (error) => {
            console.error('❌ Глобальная ошибка бота:', error.message);
        });

        // ===== РЕАКЦИЯ НА НОВОГО МЕМБЕРА =====
        this.bot.on('new_chat_members', async (msg) => {
            const chatId = msg.chat.id;
            console.log(`👥 Новый участник в чате ${chatId}`);
            
            for (const user of msg.new_chat_members) {
                const name = user.first_name || 'новичок';
                const gif = path.join(__dirname, '../../../public/image/greeting.mp4');
                
                try {
                    const fs = require('fs');
                    if (fs.existsSync(gif)) {
                        await this.bot.sendAnimation(chatId, gif);
                    } else {
                        console.log(`⚠️ Файл приветствия не найден: ${gif}`);
                    }
                    
                    await this.bot.sendMessage(chatId, `Приветствуем, ${name}!\nДобро пожаловать в клан Martian!`);
                    console.log(`✅ Приветствие отправлено для ${name}`);
                } catch (err) {
                    console.log('❌ Ошибка отправки приветствия:', err.description || err.message);
                }
            }
        });

        // ===== ФУНКЦИЯ ПРОВЕРКИ ССЫЛОК =====
        const containsLink = (text) => {
            if (!text) return false;
            const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(telegram\.me\/[^\s]+)/i;
            return linkRegex.test(text);
        };

        // ===== УДАЛЕНИЕ ССЫЛОК =====
        this.bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text || '';
            
            if (containsLink(text)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    console.log(`🗑️ Удалено сообщение со ссылкой от ${msg.from?.username || msg.from?.id}`);
                    
                    const warningMsg = await this.bot.sendMessage(chatId, `⚠️ @${msg.from?.username || 'Пользователь'}, ссылки запрещены!`);
                    
                    setTimeout(async () => {
                        try {
                            await this.bot.deleteMessage(chatId, warningMsg.message_id);
                        } catch (e) {}
                    }, 5000);
                } catch (err) {
                    console.log('❌ Ошибка удаления сообщения:', err.message);
                }
            }
        });

        // ===== КОМАНДА /start =====
        this.bot.onText(/^\/start$/, async (msg) => {
            const chatId = msg.chat.id;
            const userName = msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || 'Пользователь');
            
            console.log(`🎯 Команда /start от ${userName} (Chat ID: ${chatId})`);
            
            const startText = `🎉 Привет, ${userName}!
Добро пожаловать в Martian NFT Bot!

📊 Доступные команды:
👉 /login - открыть приложение в Telegram
👉 /me - информация о вашем аккаунте
👉 /help - полная справка
👉 /ping - проверка работы бота

🌐 Открыть приложение: ${APP_URL || 'https://bot-aanskv.onrender.com'}`;

            try {
                await this.bot.sendMessage(chatId, startText, {
                    parse_mode: undefined,
                    disable_web_page_preview: true
                });
                console.log(`✅ Ответ на /start отправлен в чат ${chatId}`);
            } catch (err) {
                console.error('❌ Ошибка отправки /start:', err.message);
            }
        });

        // ===== КОМАНДА /ping (ТЕСТОВАЯ) =====
        this.bot.onText(/^\/ping$/, async (msg) => {
            const chatId = msg.chat.id;
            console.log(`🏓 Команда /ping от ${msg.from?.username || msg.from?.id}`);
            
            try {
                await this.bot.sendMessage(chatId, '🏓 pong!');
                console.log(`✅ Ответ на /ping отправлен в чат ${chatId}`);
            } catch (err) {
                console.error('❌ Ошибка отправки /ping:', err.message);
            }
        });

        // ===== КОМАНДА /test (ТЕСТОВАЯ) =====
        this.bot.onText(/^\/test$/, async (msg) => {
            const chatId = msg.chat.id;
            console.log(`🧪 Команда /test от ${msg.from?.username || msg.from?.id}`);
            
            try {
                await this.bot.sendMessage(chatId, '✅ Бот работает корректно!');
                console.log(`✅ Ответ на /test отправлен в чат ${chatId}`);
            } catch (err) {
                console.error('❌ Ошибка отправки /test:', err.message);
            }
        });

        // ===== КОМАНДА /login =====
        this.bot.onText(/^\/login$/, async (msg) => {
            const chatId = msg.chat.id;
            const user = msg.from;
            
            console.log(`🔑 Команда /login от @${user?.username || user?.id}`);
            
            try {
                const webAppUrl = `${APP_URL || 'https://bot-aanskv.onrender.com'}?telegram_id=${user.id}&first_name=${encodeURIComponent(user.first_name || '')}&username=${encodeURIComponent(user.username || '')}`;
                
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
                
                console.log(`✅ Web App ссылка отправлена @${user.username || user.id}`);
                
            } catch (error) {
                console.error('❌ Ошибка в команде /login:', error.message);
                this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
            }
        });

        // ===== КОМАНДА /me =====
        this.bot.onText(/^\/me$/, async (msg) => {
            const chatId = msg.chat.id;
            const user = msg.from;
            
            console.log(`👤 Команда /me от @${user?.username || user?.id}`);
            
            try {
                await this.bot.sendMessage(chatId,
                    `👤 Информация о пользователе\n\n` +
                    `ID: ${user.id}\n` +
                    `Имя: ${user.first_name || 'Не указано'}\n` +
                    `Фамилия: ${user.last_name || 'Не указана'}\n` +
                    `Username: ${user.username ? '@' + user.username : 'Не указан'}\n` +
                    `Язык: ${user.language_code || 'ru'}`,
                    { parse_mode: undefined }
                );
                console.log(`✅ Информация о пользователе отправлена`);
            } catch (err) {
                console.error('❌ Ошибка отправки /me:', err.message);
            }
        });

        // ===== КОМАНДА /help =====
        this.bot.onText(/^\/help$/, (msg) => {
            const chatId = msg.chat.id;
            
            console.log(`❓ Команда /help от ${msg.from?.username || msg.from?.id}`);
            
            const helpText = `🤖 Martian NFT Bot - Справка

Основные команды:
👉 /login - открыть приложение в Telegram
👉 /me - информация о вашем аккаунте
👉 /start - начальное приветствие
👉 /help - эта справка
👉 /ping - проверка работы бота

Веб-приложение:
После нажатия на кнопку в /login приложение откроется прямо в Telegram!

🌐 Ссылка: ${APP_URL || 'https://bot-aanskv.onrender.com'}`;

            this.bot.sendMessage(chatId, helpText, { 
                parse_mode: undefined,
                disable_web_page_preview: true 
            }).then(() => {
                console.log(`✅ Справка отправлена в чат ${chatId}`);
            }).catch(err => {
                console.error('❌ Ошибка отправки /help:', err.message);
            });
        });

        // ===== КОМАНДЫ ДЛЯ АДМИНИСТРАТОРОВ =====
        this.bot.onText(/\/create_synergy_map/, async (msg) => {
            try {
                console.log(`🗺️ Команда /create_synergy_map от ${msg.from?.username || msg.from?.id}`);
                await handleCreateSynergyMap(this.bot, msg);
                console.log(`✅ Карта синергий создана`);
            } catch (error) {
                console.error('❌ Ошибка в команде /create_synergy_map:', error.message);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при создании карты синергий');
            }
        });

        this.bot.onText(/\/synergy_stats/, async (msg) => {
            try {
                console.log(`📊 Команда /synergy_stats от ${msg.from?.username || msg.from?.id}`);
                await handleShowSynergyStats(this.bot, msg);
                console.log(`✅ Статистика синергий отправлена`);
            } catch (error) {
                console.error('❌ Ошибка в команде /synergy_stats:', error.message);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при получении статистики');
            }
        });

        console.log('✅ Все команды бота успешно зарегистрированы!\n');
    }

    // ===== РЕГИСТРАЦИЯ WEBHOOK ENDPOINT =====
    registerWebhook(app) {
        if (!this.bot || !this.isProduction || !app) {
            console.log('⚠️ Webhook регистрация пропущена:', {
                bot: !!this.bot,
                isProduction: this.isProduction,
                app: !!app
            });
            return;
        }
        
        // Эндпоинт для приема обновлений от Telegram
        app.post(`/webhook/${API_TOKEN}`, (req, res) => {
            try {
                this.bot.processUpdate(req.body);
                res.sendStatus(200);
            } catch (error) {
                console.error('❌ Ошибка обработки webhook:', error.message);
                res.sendStatus(500);
            }
        });
        
        // Тестовый endpoint для проверки доступности
        app.get(`/webhook/${API_TOKEN}`, (req, res) => {
            res.send(`
                <h2>🤖 Telegram Bot Webhook</h2>
                <p>Status: <strong style="color: green;">ACTIVE</strong></p>
                <p>Bot: @zargates_martians_bot</p>
                <p>Mode: WEBHOOK</p>
                <p>Time: ${new Date().toLocaleString()}</p>
            `);
        });
        
        console.log(`🔗 Webhook endpoint зарегистрирован:`);
        console.log(`   POST /webhook/${API_TOKEN} - прием обновлений`);
        console.log(`   GET /webhook/${API_TOKEN} - проверка статуса`);
    }

    // ===== ТЕСТОВЫЕ ENDPOINT ДЛЯ ПРОВЕРКИ =====
    registerTestEndpoint(app) {
        if (!app || !this.bot) return;
        
        // Статус бота
        app.get('/api/bot/status', async (req, res) => {
            try {
                const botInfo = await this.bot.getMe();
                const webhookInfo = await this.bot.getWebHookInfo();
                
                res.json({
                    success: true,
                    timestamp: new Date().toISOString(),
                    bot: {
                        username: botInfo.username,
                        first_name: botInfo.first_name,
                        id: botInfo.id,
                        initialized: this.initialized
                    },
                    webhook: {
                        url: webhookInfo.url,
                        pending_updates: webhookInfo.pending_update_count,
                        last_error: webhookInfo.last_error_message,
                        last_error_date: webhookInfo.last_error_date
                    },
                    mode: this.isProduction ? 'webhook' : 'polling',
                    environment: {
                        NODE_ENV: process.env.NODE_ENV,
                        RENDER: process.env.RENDER,
                        APP_URL: APP_URL
                    }
                });
            } catch (error) {
                res.json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Отправка тестового сообщения
        app.post('/api/bot/send/:chatId', express.json(), async (req, res) => {
            try {
                const { chatId } = req.params;
                const { text } = req.body;
                
                const result = await this.bot.sendMessage(chatId, text || 'Тестовое сообщение от бота');
                res.json({
                    success: true,
                    message_id: result.message_id,
                    chat_id: result.chat.id
                });
            } catch (error) {
                res.json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        console.log('🧪 Тестовые endpoints зарегистрированы:');
        console.log('   GET /api/bot/status - статус бота');
        console.log('   POST /api/bot/send/:chatId - отправка сообщения');
    }

    // ===== ОСТАНОВКА БОТА =====
    async shutdown() {
        console.log('\n🛑 ОСТАНОВКА БОТА...');
        
        if (this.bot) {
            try {
                if (this.isProduction) {
                    await this.bot.deleteWebHook();
                    console.log('✅ Webhook удален');
                } else {
                    await this.bot.stopPolling();
                    console.log('✅ Polling остановлен');
                }
                console.log('✅ Бот остановлен');
            } catch (error) {
                console.error('❌ Ошибка при остановке бота:', error.message);
            }
        }
        
        this.initialized = false;
        console.log('='.repeat(50) + '\n');
    }
}

// Экспортируем ЭКЗЕМПЛЯР класса (синглтон)
module.exports = new BotService();