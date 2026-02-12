const config = require('./auth.config');
const logger = require('../../core/utils/logger');

class AuthService {
    constructor() {
        this.sessions = new Map(); // Хранилище сессий в памяти
    }

    // Создание сессии для пользователя Telegram
    createSession(telegramUser) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            telegramId: telegramUser.id,
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            authDate: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            accessLevel: this.getUserAccessLevel(telegramUser.id)
        };
        
        this.sessions.set(sessionId, session);
        logger.info(`Создана сессия для пользователя @${telegramUser.username || telegramUser.id}`);
        
        return session;
    }

    // Получение сессии по ID
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date().toISOString();
            this.sessions.set(sessionId, session);
        }
        return session;
    }

    // Удаление сессии
    destroySession(sessionId) {
        this.sessions.delete(sessionId);
        logger.info(`Сессия ${sessionId} удалена`);
    }

    // Генерация ID сессии
    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    // Проверка доступа пользователя к модулю
    checkModuleAccess(telegramId, moduleName) {
        const moduleConfig = config.MODULE_ACCESS[moduleName];
        if (!moduleConfig || !moduleConfig.enabled) {
            return false;
        }
        
        const userLevel = this.getUserAccessLevel(telegramId);
        return userLevel >= moduleConfig.minLevel;
    }

    // Получение уровня доступа пользователя
    getUserAccessLevel(telegramId) {
        if (config.ADMIN_USERS.includes(telegramId)) {
            return config.ACCESS_LEVELS.ADMIN;
        }
        if (config.AUTHORIZED_USERS.includes(telegramId)) {
            return config.ACCESS_LEVELS.USER;
        }
        return config.ACCESS_LEVELS.GUEST;
    }

    // Получение доступных модулей для пользователя
    getAvailableModules(telegramId) {
        const available = {};
        const userLevel = this.getUserAccessLevel(telegramId);
        
        for (const [moduleName, moduleConfig] of Object.entries(config.MODULE_ACCESS)) {
            available[moduleName] = {
                enabled: moduleConfig.enabled && userLevel >= moduleConfig.minLevel,
                minLevel: moduleConfig.minLevel
            };
        }
        
        return available;
    }

    // Валидация Telegram данных (подпись)
    validateTelegramData(telegramData, hash) {
        // Здесь должна быть проверка подписи от Telegram
        // Для простоты пока возвращаем true
        return true;
    }
}

module.exports = new AuthService();