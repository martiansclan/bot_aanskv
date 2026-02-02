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
        
        // Загрузка маршрутов
        this.setupRoutes();
        
        // Настройка WebSocket если доступно
        this.setupWebSocket();
        
        // Настройка обработки ошибок
        this.setupErrorHandlers();
    }
    
    setupMiddleware() {
        // Базовые middleware
        this.app.use(cors());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        this.app.use(express.static(path.join(__dirname, '../../public')));
        
        // Логирование запросов
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.url}`, { 
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }
    
    setupRoutes() {
        const router = routeLoader.loadRoutes();
        this.app.use(router);
    }
    
    setupWebSocket() {
        try {
            // Ищем модули с поддержкой WebSocket
            Object.values(this.modules).forEach(module => {
                const wsManagerPath = path.join(module.path, 'websocket-manager.js');
                
                if (fs.existsSync(wsManagerPath)) {
                    try {
                        const WebSocketManager = require(wsManagerPath);
                        if (WebSocketManager && typeof WebSocketManager.initialize === 'function') {
                            // WebSocket инициализируется позже, когда будет создан сервер
                            this.wsManager = WebSocketManager;
                            logger.info(`✅ WebSocket менеджер для модуля "${module.name}" доступен`);
                        }
                    } catch (error) {
                        logger.warning(`Не удалось загрузить WebSocket для модуля "${module.name}":`, error.message);
                    }
                }
            });
        } catch (error) {
            logger.warning('Ошибка настройки WebSocket:', error);
        }
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
        
        // Обработка 404 для остальных маршрутов
        this.app.use('*', (req, res) => {
            const indexPath = path.join(__dirname, '../../public', 'index.html');
            res.sendFile(indexPath);
        });
        
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
        
        // Инициализация WebSocket после создания сервера
        if (this.wsManager && this.server) {
            try {
                this.wsManager.initialize(this.server);
                logger.success('WebSocket сервер инициализирован');
            } catch (error) {
                logger.error('Ошибка инициализации WebSocket:', error);
            }
        }
        
        this.server.listen(this.port, () => {
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
            if (this.wsManager) {
                console.log(`📡 WebSocket: ws://localhost:${this.port}/api/power/ws`);
            }
            console.log('='.repeat(50));
        });
        
        return this.server;
    }
}

module.exports = Application;