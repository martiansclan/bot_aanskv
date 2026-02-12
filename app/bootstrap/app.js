// app/bootstrap/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const configLoader = require('./config');
const routeLoader = require('./routes');
const logger = require('../core/utils/logger');
const serviceRegistry = require('./services');

class Application {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.server = null;
        
        // Загрузка модулей
        this.modules = configLoader.loadModules();
        
        // Настройка middleware
        this.setupMiddleware();
        
        // Загрузка маршрутов
        this.setupRoutes();
        
        // Настройка обработки ошибок
        this.setupErrorHandlers();
    }
    
    setupMiddleware() {
        // Важно: raw body для webhook
        this.app.use(express.json({
            verify: (req, res, buf) => {
                req.rawBody = buf.toString();
            }
        }));
        
        // Базовые middleware
        this.app.use(cors());
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        this.app.use(express.static(path.join(__dirname, '../../public')));
        
        // Логирование запросов
        this.app.use((req, res, next) => {
            if (!req.url.startsWith('/api/TribeInfoCollector')) {
                logger.info(`${req.method} ${req.url}`);
            }
            next();
        });
    }
    
    setupRoutes() {
        const router = routeLoader.loadRoutes();
        this.app.use(router);
    }
    
    setupErrorHandlers() {
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'API endpoint not found'
            });
        });
        
        this.app.use('*', (req, res) => {
            const indexPath = path.join(__dirname, '../../public', 'index.html');
            res.sendFile(indexPath);
        });
        
        this.app.use((error, req, res, next) => {
            logger.error('Необработанная ошибка:', error);
            res.status(500).json({
                success: false,
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        });
    }
    
    async start() {
        this.server = http.createServer(this.app);
        
        this.server.listen(this.port, async () => {
            console.log('='.repeat(50));
            console.log(`🚀 Сервер запущен на порту ${this.port}`);
            console.log('='.repeat(50));
            
            // ИНИЦИАЛИЗИРУЕМ БОТА ПОСЛЕ ЗАПУСКА СЕРВЕРА
            try {
                const botService = serviceRegistry.get('bot');
                if (botService) {
                    await botService.initialize(this.app);
                    logger.success('✅ Telegram бот инициализирован');
                }
            } catch (error) {
                logger.error('❌ Ошибка инициализации бота:', error.message);
            }
            
            console.log('Доступные модули:');
            Object.values(this.modules).forEach(module => {
                console.log(`  📦 ${module.name} v${module.config.version || '1.0.0'}`);
            });
            
            console.log('='.repeat(50));
            console.log(`🌐 Главная: http://localhost:${this.port}/`);
            console.log('='.repeat(50));
        });
        
        return this.server;
    }
}

module.exports = Application;