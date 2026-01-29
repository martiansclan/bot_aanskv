const { API_TOKEN } = require('./modules/utils.js');
const TelegramBot = require('node-telegram-bot-api');

// Импорт модулей команд
const { handleShowDBStats } = require('./modules/showDBStats.js');
const { handleCreateCards } = require('./modules/createCards.js');
const { handleShowCards } = require('./modules/showCards.js');

// Импорт нового модуля для фонового сбора инфы
const { 
  collectAllNfts,
  stopCollection,  
  showCollectionStatus,
  continueCollection
} = require('./modules/collectAllNfts.js');

// ДОБАВЛЕНИЕ synergySort.js:
const { 
  handleSynergySort,
  handleSynergyCallback 
} = require('./modules/synergySort.js');

const { 
  handleCreateSynergyMap,
  handleShowSynergyStats 
} = require('./modules/createSynergyMap.js');

// ====== BOT INIT ======
const bot = new TelegramBot(API_TOKEN, { polling: true });

// ====== РЕГИСТРАЦИЯ КОМАНД ======

// Реакция на нового мембера
bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;

  for (const user of msg.new_chat_members) {
    const name = user.first_name || 'новичок';

    // Выбираем случайную GIF
    const gif = './public/image/greeting.mp4'

    try {
      // Отправляем GIF
      await bot.sendAnimation(chatId, gif);

      // Отправляем приветственное сообщение
      await bot.sendMessage(chatId, `Приветствуем, ${name}!\nДобро пожаловать в клан Martian!`);
    } catch (err) {
      console.log('Ошибка отправки приветствия:', err.description || err.message);
    }
  }
});


// Функция проверки наличия ссылок в тексте
function containsLink(text) {
  // Простая проверка на http(s):// или www.
  const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
  return linkRegex.test(text);
}

// Обработка сообщений
bot.on('message', (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text || '';
	if (containsLink(text)) {
		// Удаляем сообщение (бот должен быть админом с правом удалять сообщения)
		console.log(msg)
		bot.deleteMessage(chatId, msg.message_id).catch(err => console.log(err));

		// Можно уведомлять пользователя
		bot.sendMessage(chatId, `⚠️ Ссылки запрещены!`).catch(err => console.log(err));
	}
})

// Команда /start_collect - начинает с начала или продолжает
bot.onText(/\/start_collect(?: (\d+))?/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    
    let batchSize = 100;
    if (match && match[1]) {
      batchSize = parseInt(match[1]);
      if (batchSize < 1 || batchSize > 100) {
        await bot.sendMessage(chatId, 
          '⚠️ Размер пачки должен быть от 1 до 100. Использую 100.'
        );
        batchSize = 100;
      }
    }
    
    await continueCollection(bot, chatId);
  } catch (error) {
    console.error('Ошибка в команде /start_collect:', error);
    bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
  }
});


// Команда /stop_collect
bot.onText(/\/stop_collect/, async (msg) => {
  try {
    await stopCollection(bot, msg.chat.id);
  } catch (error) {
    console.error('Ошибка в команде /stop_collect:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при остановке сбора');
  }
});

// Команда /collect_status
bot.onText(/\/collect_status/, async (msg) => {
  try {
    await showCollectionStatus(bot, msg.chat.id);
  } catch (error) {
    console.error('Ошибка в команде /collect_status:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при получении статуса');
  }
});


// Команда /createCards
bot.onText(/\/createCards/, async (msg) => {
  try {
    await handleCreateCards(bot, msg);
  } catch (error) {
    console.error('Ошибка в команде /createCards:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при создании карточек');
  }
});

// Команда /DBstats
bot.onText(/\/DBstats/, async (msg) => {
  try {
    await handleShowDBStats(bot, msg);
  } catch (error) {
    console.error('Ошибка в команде /DBstats:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при выполнении команды');
  }
});

// Команда /show_cards
bot.onText(/\/show_cards/, async (msg) => {
  try {
    await handleShowCards(bot, msg);
  } catch (error) {
    console.error('Ошибка в команде /show_cards:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при выполнении команды');
  }
});

// Команда /show_cards с параметром количества
bot.onText(/\/show_cards (\d+)/, async (msg, match) => {
  try {
    await handleShowCards(bot, msg);
  } catch (error) {
    console.error('Ошибка в команде /show_cards:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при выполнении команды');
  }
});




// КОМАНДА /synergy_sort (новая версия с интерактивным интерфейсом)
bot.onText(/\/synergy_sort/, async (msg) => {
  console.log('📝 Получена команда /synergy_sort');
  console.log('Chat ID:', msg.chat.id);
  
  try {
    await handleSynergySort(bot, msg);
    console.log('✅ Интерфейс сортировки открыт');
  } catch (error) {
    console.error('❌ Ошибка в команде /synergy_sort:', error);
    await bot.sendMessage(msg.chat.id, 
      `❌ Ошибка при открытии интерфейса сортировки:\n${error.message}`
    );
  }  
});

// Команда /create_synergy_map
bot.onText(/\/create_synergy_map/, async (msg) => {
  try {
    await handleCreateSynergyMap(bot, msg);
  } catch (error) {
    console.error('Ошибка в команде /create_synergy_map:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при создании карты синергий');
  }
});

// Команда /synergy_stats
bot.onText(/\/synergy_stats/, async (msg) => {
  try {
    await handleShowSynergyStats(bot, msg);
  } catch (error) {
    console.error('Ошибка в команде /synergy_stats:', error);
    bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при получении статистики');
  }
});




// Обработка callback-запросов (для кнопок)
bot.on('callback_query', async (callbackQuery) => {
  try {
    const data = callbackQuery.data;
    console.log('📞 Callback получен:', data);
       
  
    // Проверяем, относится ли callback к synergy сортировке
    if (data.startsWith('synergy_') || 
        data.startsWith('skin_') || 
        data.startsWith('rarity_') ||  // ДОБАВЛЕНО
        data.startsWith('result_') ||
        data === 'synergy_back_to_select' ||
        data === 'synergy_new_search' ||
        data === 'synergy_change_params' ||
        data === 'synergy_stats' ||
        data === 'synergy_sort_execute' ||
        data === 'filter_on_sale' ||    // ДОБАВЛЕНО
        data === 'filter_all') {        // ДОБАВЛЕНО
      await handleSynergyCallback(bot, callbackQuery);
    }
    else {
      console.log('❓ Неизвестный callback:', data);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Неизвестная команда' });
    }
  } catch (error) {
    console.error('❌ Ошибка обработки callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка при обработке запроса' });
  }
});

// ====== КОМАНДА /start ======
bot.onText(/^\/start$/, (msg) => {

  const chatId = msg.chat.id;
  
  const startText = `🎉 Добро пожаловать в Martian NFT Bot!

👉 /help - полная справка по командам
`;

  bot.sendMessage(chatId, startText, {
    parse_mode: undefined,
    disable_web_page_preview: true
  });
});

// ====== КОМАНДА /help (без Markdown) ======
bot.onText(/^\/help$/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🤖 Martian NFT Bot - Полная справка по командам

🃏 Основные команды:

👉 /start_collect - начать сбор ВСЕХ NFT
👉 /stop_collect - остановить сбор
👉 /collect_status - статус сбора
👉 /DBstats - статистика базы данных

👉 /createCards - Создает HTML карточки NFT из базы данных
👉 /show_cards [число] - показывает карточки NFT
  
👉 /synergy_sort - интерактивная сортировка NFT
    • *Особенности:*
      - Выбор уровня синергии (2 или 3+ совпадений атрибутов)
      - Выбор конкретных Skin Tone из 18 вариантов
      - Постраничная навигация по Skin Tone
      - Массовый выбор/очистка кнопками
      - Статистика и экспорт результатов

👉 /create_synergy_map - создает карту синергий на основе атрибутов
👉 /synergy_stats - показывает статистику карты синергий

`;

  bot.sendMessage(chatId, helpText, {
    parse_mode: undefined, // Без разметки
    disable_web_page_preview: true
  });
});

// ====== ОБРАБОТКА ОШИБОК ======
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('❌ Webhook error:', error);
});

// ====== ЗАПУСК БОТА ======
async function startBot() {
  console.log('🤖 Запуск бота annskv...');
  
  const { ensureDataDir } = require('./modules/utils.js');
  await ensureDataDir();
  
  console.log('✅ Бот успешно запущен!'); 
  
}

// Запускаем бота
startBot();