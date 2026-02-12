// app/bootstrap/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const configLoader = require('./config');
const routeLoader = require('./routes');
const logger = require('../core/utils/logger');

class Application {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.server = null;
        
        // Загрузка модулей
        this.modules = configLoader.loadModules();
        
        // Настройка middleware
        this.setupMiddleware();
        
        // 🚨 ВАЖНО: Webhook регистрируется ДО всех маршрутов!
        this.setupWebhook();
        
        // Загрузка маршрутов
        this.setupRoutes();
        
        // Настройка обработки ошибок (БЕЗ глобального '*')
        this.setupErrorHandlers();
    }
    
    setupMiddleware() {
        // Базовые middleware
        this.app.use(cors());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Логирование запросов
        this.app.use((req, res, next) => {
            if (!req.url.startsWith('/api/TribeInfoCollector')) {
                logger.info(`${req.method} ${req.url}`, { 
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }
            next();
        });
    }
    
    // 🚨 НОВЫЙ МЕТОД - регистрация webhook в приоритете
    setupWebhook() {
        try {
            const botService = require('../modules/bot/bot.service');
            if (botService && botService.isProduction && botService.bot) {
                const { API_TOKEN } = require('../../../modules/utils.js');
                const webhookPath = `/webhook/${API_TOKEN}`;
                
                // POST - для Telegram
                this.app.post(webhookPath, (req, res) => {
                    console.log('📨 Webhook received!');
                    try {
                        botService.bot.processUpdate(req.body);
                        res.sendStatus(200);
                    } catch (error) {
                        console.error('❌ Webhook error:', error.message);
                        res.sendStatus(500);
                    }
                });
                
                // GET - для проверки
                this.app.get(webhookPath, (req, res) => {
                    res.send(`
                        <h2>🤖 Telegram Bot Webhook</h2>
                        <p>Status: <strong style="color: green;">ACTIVE</strong></p>
                        <p>Time: ${new Date().toLocaleString()}</p>
                    `);
                });
                
                console.log(`✅ Webhook endpoint зарегистрирован: ${webhookPath}`);
            }
        } catch (error) {
            console.error('⚠️ Webhook registration error:', error.message);
        }
    }
    
    setupRoutes() {
        // Статические файлы - ПОСЛЕ webhook, НО ДО глобальных обработчиков
        this.app.use(express.static(path.join(__dirname, '../../public')));
        
        // API маршруты модулей
        const router = routeLoader.loadRoutes();
        this.app.use(router);
    }
    
    setupErrorHandlers() {
        // Обработка 404 для API
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'API endpoint not found',
                path: req.originalUrl,
                timestamp: new Date().toISOString()
            });
        });
        
        // 🚨 ТОЛЬКО для корневого пути, НЕ для всех!
        this.app.get('/', (req, res) => {
            const indexPath = path.join(__dirname, '../../public', 'index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.send('Server is running');
            }
        });
        
        // 🚨 УБИРАЕМ ГЛОБАЛЬНЫЙ '*' ОБРАБОТЧИК - ОН ЛОМАЕТ WEBHOOK!
        
        // Глобальный обработчик ошибок
        this.app.use((error, req, res, next) => {
            logger.error('Необработанная ошибка:', error);
            
            res.status(500).json({
                success: false,
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
        });
    }
    
    start() {
        this.server = http.createServer(this.app);
        
        this.server.listen(this.port, '0.0.0.0', () => {
            console.log('='.repeat(50));
            console.log(`🚀 Сервер запущен на порту ${this.port}`);
            console.log(`📁 Загружено модулей: ${Object.keys(this.modules).length}`);
            console.log('='.repeat(50));
            console.log('Доступные модули:');
            
            Object.values(this.modules).forEach(module => {
                console.log(`  📦 ${module.name} v${module.config.version || '1.0.0'}`);
                console.log(`     API: http://localhost:${this.port}${module.config.routesPrefix || `/api/${module.name}`}`);
                const pagePath = path.join(__dirname, '../../public', `${module.name}.html`);
                if (fs.existsSync(pagePath)) {
                    console.log(`     Страница: http://localhost:${this.port}/${module.name}`);
                }
            });
            
            console.log('='.repeat(50));
            console.log(`🌐 Главная: http://localhost:${this.port}/`);
            console.log('='.repeat(50));
        });
        
        return this.server;
    }
}

module.exports = Application;