module.exports = {
    SESSION_SECRET: process.env.SESSION_SECRET || 'martian-secret-key',
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 часа
    COOKIE_NAME: 'martian_session',
    
    // Уровни доступа
    ACCESS_LEVELS: {
        GUEST: 0,
        USER: 1,
        ADMIN: 2
    },
    
    // Доступные модули и требуемые уровни доступа
    MODULE_ACCESS: {
        'power': { minLevel: 0, enabled: true },           // Доступен всем
        'sort': { minLevel: 1, enabled: true },            // Только авторизованным
        'orc-exchange': { minLevel: 2, enabled: true },    // Только админам
        'TribeInfoCollector': { minLevel: 2, enabled: false }, // Отключен
        'TribeWalletInfoCollector': { minLevel: 2, enabled: false } // Отключен
    },
    
    // Белый список пользователей Telegram
    AUTHORIZED_USERS: [
        123456789, // Замените на реальные ID пользователей
        // Добавляйте сюда ID пользователей, которым разрешен доступ
    ],
    
    // Администраторы
    ADMIN_USERS: [
        987654321 // Замените на реальные ID администраторов
    ]
};