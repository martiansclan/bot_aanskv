// app/modules/bot/bot.status.js
const serviceRegistry = require('../../bootstrap/services');

async function checkBotStatus() {
    try {
        const botService = serviceRegistry.get('bot');
        
        if (!botService) {
            console.log('❌ Бот не зарегистрирован в сервисах');
            return;
        }
        
        console.log('🤖 Информация о боте:');
        console.log(`   Инициализирован: ${botService.initialized}`);
        console.log(`   Режим: ${botService.isProduction ? 'WEBHOOK' : 'POLLING'}`);
        console.log(`   Бот существует: ${botService.bot ? '✅' : '❌'}`);
        
        if (botService.bot) {
            // Проверяем webhook
            try {
                const webhookInfo = await botService.bot.getWebHookInfo();
                console.log('\n📊 Информация о webhook:');
                console.log(`   URL: ${webhookInfo.url || 'не установлен'}`);
                console.log(`   Ожидающие обновления: ${webhookInfo.pending_update_count}`);
                console.log(`   Последняя ошибка: ${webhookInfo.last_error_message || 'нет'}`);
                
                if (webhookInfo.last_error_message) {
                    console.log(`   ❌ Ошибка webhook: ${webhookInfo.last_error_message}`);
                }
            } catch (error) {
                console.log('❌ Ошибка получения информации о webhook:', error.message);
            }
            
            // Проверяем команды
            console.log('\n📝 Зарегистрированные обработчики:');
            if (botService.bot._events) {
                const handlers = Object.keys(botService.bot._events).filter(
                    key => key === 'text' || key === 'message' || key.includes('text')
                );
                console.log(`   События: ${handlers.join(', ') || 'нет'}`);
            }
        }
        
        return botService;
    } catch (error) {
        console.log('❌ Ошибка проверки бота:', error.message);
    }
}

module.exports = { checkBotStatus };