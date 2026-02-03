module.exports = {
    enabled: true,
    name: 'orc-exchange',
    title: 'Обмен орками',
    description: 'Оптимизация обмена карточками орков между игроками',
    version: '1.0.0',
    
    // API префикс будет /api/orc-exchange
    routesPrefix: '/api/orc-exchange',
    
    // Настройки алгоритма
    algorithm: {
        maxIterations: 100,
        maxExchangesPerIteration: 10,
        enableMultiExchange: false
    },
    
    // Бонусы за совпадения
    bonuses: {
        earrings: {
            4: 400,
            5: 500,
            6: 700,
            7: 1000
        },
        amulet: {
            4: 400,
            5: 500,
            6: 700,
            7: 1000
        },
        bracelet: {
            4: 400
        }
    }
};