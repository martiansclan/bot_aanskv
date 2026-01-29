const fs = require('fs').promises;
const path = require('path');
const { MAIN_DATA_FILE, ensureDataDir } = require('./utils.js');

async function getDataStats() {
  try {
    // Убеждаемся что папка существует
    await ensureDataDir();
    
    // Определяем путь к файлу all_nft_info.json
    const summaryFilePath = path.join(path.dirname(MAIN_DATA_FILE), 'all_nft_info.json');
    
    // Проверяем существует ли файл
    try {
      await fs.access(summaryFilePath);
    } catch (err) {
      return { success: false, error: 'Файл all_nft_info.json не найден. Сначала выполните сбор данных с помощью /start_collect' };
    }
    
    // Читаем файл
    const fileContent = await fs.readFile(summaryFilePath, 'utf8');
    const allData = JSON.parse(fileContent);
    
    if (!allData.nfts || !Array.isArray(allData.nfts) || allData.nfts.length === 0) {
      return { success: false, error: 'Нет данных NFT в файле' };
    }
    
    const nfts = allData.nfts;
    
    // Подсчет статистики
    const uniqueNFTs = [...new Set(nfts.map(item => item.address))].length;
    const uniqueOwners = [...new Set(nfts.map(item => item.owner_address))].length;
    
    return {
      success: true,
      totalNfts: allData.collection_info?.nft_quantity || 0,
      nftsInFile: nfts.length,
      uniqueNFTs: uniqueNFTs,
      uniqueOwners: uniqueOwners,
      lastUpdated: allData.collection_info?.last_updated,
      completionPercent: allData.collection_info?.nft_quantity > 0 
        ? Math.round((nfts.length / allData.collection_info.nft_quantity) * 100) 
        : 100
    };
    
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error.message);
    return { 
      success: false, 
      error: `Ошибка чтения файла данных: ${error.message}` 
    };
  }
}

async function handleShowDBStats(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const statsResult = await getDataStats();
    
    if (!statsResult.success) {
      return bot.sendMessage(chatId, `📭 ${statsResult.error}`);
    }

    // Формируем сообщение
    let statsMessage = ``;
    
    // Основная информация
    statsMessage += `📊 Всего NFT в коллекции: ${statsResult.totalNfts}\n`;
    statsMessage += `📁 NFT в файле: ${statsResult.nftsInFile}\n`;
    statsMessage += `🔄 Завершено: ${statsResult.completionPercent}%\n`;
    statsMessage += `🔢 Уникальных NFT: ${statsResult.uniqueNFTs}\n`;
    statsMessage += `👤 Уникальных владельцев: ${statsResult.uniqueOwners}\n`;
    
    // Информация о времени
    statsMessage += `⏰ Последнее обновление: ${statsResult.lastUpdated ? new Date(statsResult.lastUpdated).toLocaleString('ru-RU') : 'нет данных'}`;

    await bot.sendMessage(chatId, statsMessage, { parse_mode: undefined });

  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    await bot.sendMessage(
      chatId, 
      '❌ Ошибка при получении статистики. Проверьте логи бота.'
    );
  }
}

module.exports = { handleShowDBStats };