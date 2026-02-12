const authService = require('./auth.service');
const logger = require('../../core/utils/logger');

class AuthController {
    // Вход через Telegram
    async telegramLogin(req, res) {
        try {
            const { id, username, first_name, last_name, hash } = req.body;
            
            // Валидация данных от Telegram
            if (!authService.validateTelegramData(req.body, hash)) {
                return res.status(401).json({ error: 'Неверная подпись' });
            }
            
            // Создаем сессию
            const session = authService.createSession({
                id,
                username,
                first_name,
                last_name
            });
            
            // Устанавливаем cookie с сессией
            res.cookie('session_id', session.id, {
                maxAge: 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            });
            
            // Получаем доступные модули
            const availableModules = authService.getAvailableModules(id);
            
            res.json({
                success: true,
                session: {
                    id: session.id,
                    user: {
                        id,
                        username,
                        first_name,
                        last_name
                    },
                    accessLevel: session.accessLevel,
                    availableModules
                }
            });
            
        } catch (error) {
            logger.error('Ошибка при входе через Telegram:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }

    // Проверка текущей сессии
    async checkSession(req, res) {
        const sessionId = req.cookies.session_id;
        
        if (!sessionId) {
            return res.status(401).json({ error: 'Нет активной сессии' });
        }
        
        const session = authService.getSession(sessionId);
        if (!session) {
            return res.status(401).json({ error: 'Сессия не найдена' });
        }
        
        const availableModules = authService.getAvailableModules(session.telegramId);
        
        res.json({
            success: true,
            session: {
                user: {
                    id: session.telegramId,
                    username: session.username,
                    first_name: session.firstName
                },
                accessLevel: session.accessLevel,
                availableModules
            }
        });
    }

    // Выход из системы
    async logout(req, res) {
        const sessionId = req.cookies.session_id;
        
        if (sessionId) {
            authService.destroySession(sessionId);
            res.clearCookie('session_id');
        }
        
        res.json({ success: true });
    }

    // Получение конфигурации модулей для клиента
    async getModulesConfig(req, res) {
        const sessionId = req.cookies.session_id;
        let availableModules = {};
        
        if (sessionId) {
            const session = authService.getSession(sessionId);
            if (session) {
                availableModules = authService.getAvailableModules(session.telegramId);
            }
        }
        
        res.json({
            success: true,
            modules: availableModules
        });
    }
}

module.exports = new AuthController();