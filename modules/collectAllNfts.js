const {
  makeTonCenterRequest,
  COLLECTION_ADDRESS_UF,   
  COLLECT_DATA_FILE,
  ensureDataDir, 
  sleep
 
} = require('./utils.js');
const fs = require('fs').promises;
const path = require('path');

// Глобальные переменные для управления процессом сбора
let collectionProcess = {
  isRunning: false,
  chatId: null,
  bot: null,
  currentStage: 0 // 0=не начат, 1=этап 1, 2=этап 2, 3=этап 3
};

/**
 * Отправляет сообщение с задержкой, чтобы избежать лимита Telegram
 */
async function sendMessageWithDelay(bot, chatId, text, options = {}) {
  // Задержка 500мс между сообщениями для избежания лимита 429
  await sleep(500);
  return await bot.sendMessage(chatId, text, options);
}

/**
 * Создает или проверяет файл данных
 */
async function ensureDataFile() {
  try {
    await ensureDataDir();
    
    try {
      await fs.access(COLLECT_DATA_FILE);
      
      // Читаем существующий файл
      const content = await fs.readFile(COLLECT_DATA_FILE, 'utf8');
      if (content.trim() === '') {
        // Файл пустой, создаем структуру
        const initialData = {
          collection_info: {
            nft_quantity: 0,
            last_updated: null,
            last_processed_index: 0
          },
          nfts: []
        };
        await fs.writeFile(COLLECT_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
        console.log('📁 Создана структура файла данных');
      }
    } catch (err) {
      // Файла нет, создаем с структурой
      const initialData = {
        collection_info: {
          nft_quantity: 0,
          last_updated: null,
          last_processed_index: 0
        },
        nfts: []
      };
      await fs.writeFile(COLLECT_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      console.log(`📁 Создан файл данных: ${COLLECT_DATA_FILE}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка создания файла данных:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Читает данные из файла
 */
async function readDataFile() {
  try {
    const content = await fs.readFile(COLLECT_DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Ошибка чтения файла данных:', error.message);
    return {
      collection_info: {
        nft_quantity: 0,
        last_updated: null,
        last_processed_index: 0
      },
      nfts: []
    };
  }
}

/**
 * Записывает данные в файл
 */
async function writeDataFile(data) {
  try {
    await fs.writeFile(COLLECT_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка записи в файл данных:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Создает файл с сокращенной структурой данных (без информации об этапах)
 */
async function createSummaryFile() {
  try {
    console.log('📝 Создание сокращенного файла данных...');
    
    // 1. Читаем полные данные
    const fullData = await readDataFile();
    
    // 2. Формируем сокращенную структуру
    const summaryData = {
      collection_info: {
        nft_quantity: fullData.collection_info.nft_quantity || 0,
        last_updated: new Date().toISOString(),
        last_processed_index: fullData.collection_info.last_processed_index || 0
      },
      nfts: []
    };
    
    // 3. Копируем только нужные поля для каждого NFT
    for (const nft of fullData.nfts) {
      const summaryNft = {
        index: nft.index,
        address: nft.address,
        owner_address: nft.owner_address,
        user_friendly_address: nft.user_friendly_address || '',
        name: nft.name || '',
        image_url: nft.image_url || '',
        attributes: Array.isArray(nft.attributes) ? [...nft.attributes] : [],
        getgems_url: nft.getgems_url || '',
        owner_url: nft.owner_url || ''
      };
      
      // Фильтруем пустые поля (опционально)
      summaryData.nfts.push(summaryNft);
    }
    
    // 4. Определяем имя файла - ИСПРАВЛЕНО: используем ту же директорию что и основной файл
    const summaryFileName = 'all_nft_info.json';
    const summaryFilePath = path.join(path.dirname(COLLECT_DATA_FILE), summaryFileName);
    
    // 5. Создаем директорию если нужно
    await ensureDataDir();
    
    console.log(`📊 Количество NFT для записи: ${summaryData.nfts.length}`);
    
    // 6. Записываем файл
    await fs.writeFile(
      summaryFilePath, 
      JSON.stringify(summaryData, null, 2), 
      'utf8'
    );
    
    // Проверяем что файл создан
    const fileSize = (await fs.stat(summaryFilePath)).size;
    
    console.log(`✅ Создан сокращенный файл: ${summaryFileName}`);
    console.log(`📊 Количество NFT: ${summaryData.nfts.length}`);
    console.log(`💾 Размер: ${fileSize / 1024} KB`);
    
    return {
      success: true,
      fileName: summaryFileName,
      filePath: summaryFilePath,
      nftCount: summaryData.nfts.length,
      fileSize: fileSize
    };
    
  } catch (error) {
    console.error('❌ Ошибка создания сокращенного файла:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Создает сокращенный файл и отправляет статистику в Telegram
 */
async function createAndSendSummary(bot, chatId) {
  try {
    await sendMessageWithDelay(bot, chatId, '📝 Создаю сокращенный файл данных...');
    
    const result = await createSummaryFile();
    
    if (result.success) {
      const fileSizeMB = (result.fileSize / 1024 / 1024).toFixed(2);
      
      return { success: true, result };
    } else {
      await sendMessageWithDelay(bot, chatId, 
        `❌ Ошибка создания файла: ${result.error}`
      );
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('❌ Ошибка отправки сокращенного файла:', error);
    await sendMessageWithDelay(bot, chatId, 
      `❌ Ошибка создания/отправки файла: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Получает информацию о коллекции и количество NFT
 */
async function getCollectionInfo() {
  try {
    console.log('🔗 Получение информации о коллекции...');
    
    // Используем user-friendly адрес для первого запроса
    const url = `https://toncenter.com/api/v3/nft/items?collection_address=${COLLECTION_ADDRESS_UF}&limit=1`;
    
    const data = await makeTonCenterRequest(url);
    console.log('✅ Получен ответ от API');
    
    let totalNfts = 0;
    let collectionData = null;
    
    if (data.collection && data.collection.next_item_index) {
      totalNfts = parseInt(data.collection.next_item_index);
      collectionData = data.collection;
    } else if (data.nft_items && data.nft_items.length > 0) {
      const firstItem = data.nft_items[0];
      if (firstItem.collection && firstItem.collection.next_item_index) {
        totalNfts = parseInt(firstItem.collection.next_item_index);
        collectionData = firstItem.collection;
      }
    }
    
    if (totalNfts === 0) {
      return {
        success: false,
        error: 'Не удалось определить количество NFT в коллекции'
      };
    }
    
    console.log(`📊 Всего NFT в коллекции: ${totalNfts}`);
    
    return {
      success: true,
      totalNfts: totalNfts,
      collectionData: collectionData
    };
    
  } catch (error) {
    console.error('❌ Ошибка получения информации о коллекции:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ЭТАП 1: Получает базовую информацию о NFT
 */
async function stage1FetchBasicInfo(bot, chatId, batchSize = 100) {
  try {
    let allData = await readDataFile();
    
    // Получаем актуальное количество NFT
    const collectionInfo = await getCollectionInfo();
    if (!collectionInfo.success) {
      await sendMessageWithDelay(bot, chatId, `❌ Ошибка: ${collectionInfo.error}`);
      return { success: false };
    }
    
    const totalNfts = collectionInfo.totalNfts;
    
    // Сохраняем текущий прогресс перед обновлением
    const currentLastProcessed = allData.collection_info.last_processed_index || 0;
    const currentNftCount = allData.nfts.length;
    
    // Обновляем информацию о коллекции
    allData.collection_info.nft_quantity = totalNfts;
    allData.collection_info.last_updated = new Date().toISOString();
    allData.collection_info.last_processed_index = currentLastProcessed; // Восстанавливаем!
    
    await writeDataFile(allData);
    
    // Начинаем с того места, где остановились
    let offset = currentLastProcessed;
    
    // Если уже все NFT обработаны на этапе 1
    if (offset >= totalNfts) {
      await sendMessageWithDelay(bot, chatId, `✅ Этап 1 уже завершен! Перехожу к этапу 2...`);
      return { success: true, totalNfts: totalNfts };
    }
    
    const remaining = totalNfts - offset;
    console.log(`🔄 Этап 1: Начинаю обработку ${remaining} NFT`);
    
    let batchNumber = Math.floor(offset / batchSize);
    let totalProcessed = 0;
    
    while (offset < totalNfts && collectionProcess.isRunning) {
      batchNumber++;
      
      const limit = Math.min(batchSize, totalNfts - offset);
      
      if (batchNumber % 10 === 0) {
        console.log(`📦 Пачка ${batchNumber}: offset=${offset}, обработано=${totalProcessed}/${remaining}`);
      }
      
      const url = `https://toncenter.com/api/v3/nft/items?collection_address=${COLLECTION_ADDRESS_UF}&limit=${limit}&offset=${offset}`;
      const response = await makeTonCenterRequest(url);
      
      if (!response.nft_items || response.nft_items.length === 0) {
        console.log('⚠️ Пустая пачка, возможно конец коллекции');
        break;
      }
      
      for (const nftItem of response.nft_items) {
        if (!collectionProcess.isRunning) break;
        
        const nftIndex = parseInt(nftItem.index || '0');
        const nftAddress = nftItem.address;
        const ownerAddress = nftItem.owner_address || '';
        
        // Проверяем, есть ли уже такой NFT
        const existingIndex = allData.nfts.findIndex(nft => 
          nft.address === nftAddress || nft.index === nftIndex
        );
        
        if (existingIndex === -1) {
          // Добавляем новую запись
          allData.nfts.push({
            index: nftIndex,
            address: nftAddress,
            owner_address: ownerAddress,
            stage1_completed: true,
            stage1_timestamp: new Date().toISOString(),
            // Эти поля будут заполнены на следующих этапах
            user_friendly_address: '',
            name: '',
            image_url: '',
            attributes: [],
            getgems_url: '',
            owner_url: '',
            stage2_completed: false,
            stage3_completed: false
          });
        } else {
          // Обновляем существующую запись
          allData.nfts[existingIndex].owner_address = ownerAddress;
          allData.nfts[existingIndex].stage1_completed = true;
          allData.nfts[existingIndex].stage1_timestamp = new Date().toISOString();
        }
      }
      
      offset += limit;
      totalProcessed += response.nft_items.length;
      
      // Обновляем последний обработанный индекс
      allData.collection_info.last_processed_index = offset;
      
      // Сохраняем прогресс каждые 500 NFT
      if (totalProcessed % 500 === 0) {
        await writeDataFile(allData);
      }
      
      // Задержка между пачками
      if (collectionProcess.isRunning && offset < totalNfts) {
        await sleep(1000);
      }
    }
    
    // Финальное сохранение
    allData.nfts.sort((a, b) => a.index - b.index);
    await writeDataFile(allData);
    
    console.log(`✅ Этап 1 завершен! Обработано: ${totalProcessed} NFT`);
    await sendMessageWithDelay(bot, chatId, `✅ Этап 1 завершен!`);
    
    return { success: true, totalNfts: totalNfts };
    
  } catch (error) {
    console.error('❌ Ошибка на этапе 1:', error.message);
    await sendMessageWithDelay(bot, chatId, `❌ Ошибка на этапе 1: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * ЭТАП 2: Получает детальную информацию о NFT
 */
async function stage2FetchDetails(bot, chatId) {
  try {
    let allData = await readDataFile();
    
    const totalNfts = allData.nfts.length;
    if (totalNfts === 0) {
      console.log('❌ Нет данных для обработки на этапе 2');
      await sendMessageWithDelay(bot, chatId, '❌ Нет данных для обработки. Запустите сначала этап 1.');
      return { success: false };
    }
    
    // Находим NFT, которые еще не обработаны на этапе 2
    const pendingNfts = allData.nfts.filter(nft => !nft.stage2_completed);
    const pendingCount = pendingNfts.length;
    
    if (pendingCount === 0) {
      console.log('✅ Все NFT уже обработаны на этапе 2');
      await sendMessageWithDelay(bot, chatId, '✅ Этап 2 уже завершен.');
      return { success: true, processed: 0 };
    }
    
    console.log(`🔄 Этап 2: Начинаю обработку ${pendingCount} NFT`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < pendingNfts.length && collectionProcess.isRunning; i++) {
      const nft = pendingNfts[i];
      const nftIndex = allData.nfts.findIndex(item => item.address === nft.address);
      
      processedCount++;
      
      // Логируем прогресс каждые 500 NFT
      if (processedCount % 500 === 0) {
        console.log(`📊 Прогресс этапа 2: ${processedCount}/${pendingCount}`);
      }
      
      try {
        // 1. Получаем user-friendly адрес
        const addressUrl = `https://toncenter.com/api/v3/addressBook?address=${encodeURIComponent(nft.address)}`;
        const addressData = await makeTonCenterRequest(addressUrl);
        
        let userFriendly = nft.address;
        if (addressData && addressData[nft.address]) {
          userFriendly = addressData[nft.address].user_friendly || nft.address;
        }
        
        // 2. Получаем метаданные
        const metadataUrl = `https://toncenter.com/api/v3/metadata?address=${encodeURIComponent(nft.address)}`;
        const metadataData = await makeTonCenterRequest(metadataUrl);
        
        let name = 'Не указано';
        let imageUrl = '';
        let attributes = [];
        
        if (metadataData && metadataData[nft.address]) {
          const tokenData = metadataData[nft.address];
          if (tokenData.token_info && tokenData.token_info.length > 0) {
            const tokenInfo = tokenData.token_info[0];
            
            name = tokenInfo.name || 'Не указано';
            
            if (tokenInfo.extra) {
              imageUrl = tokenInfo.extra._image_medium || tokenInfo.extra._image_small || '';
              attributes = tokenInfo.extra.attributes || [];
            }
          }
        }
        
        // Обновляем данные NFT
        allData.nfts[nftIndex].user_friendly_address = userFriendly;
        allData.nfts[nftIndex].name = name;
        allData.nfts[nftIndex].image_url = imageUrl;
        allData.nfts[nftIndex].attributes = attributes;
        allData.nfts[nftIndex].stage2_completed = true;
        allData.nfts[nftIndex].stage2_timestamp = new Date().toISOString();
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Ошибка обработки NFT ${nft.address.substring(0, 20)}`);
        allData.nfts[nftIndex].stage2_error = error.message;
        errorCount++;
      }
      
      // Сохраняем прогресс каждые 100 NFT
      if (processedCount % 100 === 0) {
        await writeDataFile(allData);
      }
    }
    
    // Финальное сохранение
    await writeDataFile(allData);
    
    console.log(`✅ Этап 2 завершен! Успешно: ${successCount}, Ошибок: ${errorCount}`);
    await sendMessageWithDelay(bot, chatId, `✅ Этап 2 завершен!`);
    
    return { 
      success: true, 
      processed: successCount,
      errors: errorCount 
    };
    
  } catch (error) {
    console.error('❌ Ошибка на этапе 2:', error.message);
    await sendMessageWithDelay(bot, chatId, `❌ Ошибка на этапе 2: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * ЭТАП 3: Формирование ссылок (оптимизированная версия)
 */
async function stage3GenerateLinks(bot, chatId) {
  try {
    let allData = await readDataFile();
    
    const totalNfts = allData.nfts.length;
    if (totalNfts === 0) {
      console.log('❌ Нет данных для обработки на этапе 3');
      await sendMessageWithDelay(bot, chatId, '❌ Нет данных для обработки.');
      return { success: false };
    }
    
    // Находим NFT, которые еще не обработаны на этапе 3
    const pendingNfts = allData.nfts.filter(nft => 
      nft.stage2_completed && !nft.stage3_completed
    );
    const pendingCount = pendingNfts.length;
    
    if (pendingCount === 0) {
      console.log('✅ Все NFT уже обработаны на этапе 3');
      await sendMessageWithDelay(bot, chatId, '✅ Этап 3 уже завершен.');
      return { success: true, processed: 0 };
    }
    
    console.log(`🔄 Этап 3: Начинаю обработку ${pendingCount} NFT`);
    
    let processedCount = 0;
    let successCount = 0;
    
    // Обрабатываем все NFT в одном цикле без задержек
    for (let i = 0; i < pendingNfts.length && collectionProcess.isRunning; i++) {
      const nft = pendingNfts[i];
      const nftIndex = allData.nfts.findIndex(item => item.address === nft.address);
      
      processedCount++;
      
      try {
        // 1. Ссылка на страницу NFT на Getgems.io
        const nftAddressForUrl = nft.user_friendly_address || nft.address;
        const getgemsUrl = `https://getgems.io/collection/${COLLECTION_ADDRESS_UF}/${nftAddressForUrl}`;
        
        // 2. Ссылка на профиль владельца
        let ownerUrl = '';
        if (nft.owner_address && nft.owner_address.trim() !== '') {
          ownerUrl = `https://getgems.io/user/${nft.owner_address}`;
        }
        
        // 3. Обновляем данные NFT
        allData.nfts[nftIndex].getgems_url = getgemsUrl;
        allData.nfts[nftIndex].owner_url = ownerUrl;
        allData.nfts[nftIndex].stage3_completed = true;
        allData.nfts[nftIndex].stage3_timestamp = new Date().toISOString();
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Ошибка генерации ссылок для NFT ${nft.index}`);
        allData.nfts[nftIndex].stage3_error = error.message;
      }
    }
    
    // Финальное сохранение
    await writeDataFile(allData);
    
    console.log(`✅ Этап 3 завершен! Обработано: ${successCount} NFT`);
    await sendMessageWithDelay(bot, chatId, `✅ Этап 3 завершен!`);
    
    return { 
      success: true, 
      processed: successCount 
    };
    
  } catch (error) {
    console.error('❌ Ошибка на этапе 3:', error.message);
    await sendMessageWithDelay(bot, chatId, `❌ Ошибка на этапе 3: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Полный сбор данных (все три этапа)
 */
async function collectAllNfts(bot, chatId, options = {}) {
  const {
    batchSize = 100,
    startFromStage = 1
  } = options;

  // ОБЕСПЕЧИВАЕМ СУЩЕСТВОВАНИЕ ФАЙЛА ДАННЫХ
  await ensureDataFile();
  
  if (collectionProcess.isRunning) {
    await sendMessageWithDelay(bot, chatId, '⚠️ Сбор данных уже запущен. Используйте /stop_collect для остановки.');
    return;
  }

  try {
    // Устанавливаем флаги процесса
    collectionProcess.isRunning = true;
    collectionProcess.chatId = chatId;
    collectionProcess.bot = bot;
    
    // Читаем текущие данные ПЕРЕД запуском
    let allData = await readDataFile();
    
    // Получаем информацию о коллекции
    const collectionInfo = await getCollectionInfo();
    const totalNfts = collectionInfo.success ? collectionInfo.totalNfts : 0;
    
    // Сохраняем текущий прогресс
    const currentProgress = allData.collection_info.last_processed_index || 0;
    const nftsInFile = allData.nfts.length;
    
    // Отправляем только начальное сообщение
    await sendMessageWithDelay(bot, chatId,
      `🚀 Запуск сбора данных\n\n` +
      `📊 Всего NFT в коллекции: ${totalNfts}\n` +
      `📁 NFT в файле: ${nftsInFile}\n` +
      `🔄 Начинаю с этапа: ${startFromStage}`
    );
    
    console.log(`🚀 Начинаю сбор данных:`);
    console.log(`   Всего NFT: ${totalNfts}`);
    console.log(`   NFT в файле: ${nftsInFile}`);
    console.log(`   Начинаю с этапа: ${startFromStage}`);
    
    let stage1Result, stage2Result, stage3Result;
    
    // ========== ЭТАП 1: Базовая информация ==========
    if (startFromStage <= 1 && collectionProcess.isRunning) {
      collectionProcess.currentStage = 1;
      
      // Проверяем, нужно ли выполнять этап 1
      const needStage1 = currentProgress < totalNfts;
      
      if (needStage1) {
        console.log('🔄 Начинаю этап 1');
        stage1Result = await stage1FetchBasicInfo(bot, chatId, batchSize);
        
        if (!stage1Result.success) {
          throw new Error(`Этап 1 завершился с ошибкой: ${stage1Result.error}`);
        }
      } else {
        console.log('✅ Этап 1 уже завершен');
      }
    }
    
    // ========== ЭТАП 2: Детальная информация ==========
    if (collectionProcess.isRunning) {
      collectionProcess.currentStage = 2;
      
      allData = await readDataFile();
      const pendingForStage2 = allData.nfts.filter(nft => !nft.stage2_completed).length;
      
      console.log(`🔍 Этап 2: ${pendingForStage2} NFT требуют обработки`);
      
      if (pendingForStage2 > 0) {
        console.log(`🔄 Начинаю этап 2`);
        stage2Result = await stage2FetchDetails(bot, chatId);
        
        if (!stage2Result.success) {
          throw new Error(`Этап 2 завершился с ошибкой: ${stage2Result.error}`);
        }
      } else {
        console.log('✅ Этап 2 уже завершен');
      }
    }
    
    // ========== ЭТАП 3: Генерация ссылок ==========
    if (collectionProcess.isRunning) {
      collectionProcess.currentStage = 3;
      
      allData = await readDataFile();
      const pendingForStage3 = allData.nfts.filter(nft => 
        nft.stage2_completed && !nft.stage3_completed
      ).length;
      
      console.log(`🔍 Этап 3: ${pendingForStage3} NFT требуют обработки`);
      
      if (pendingForStage3 > 0) {
        console.log(`🔄 Начинаю этап 3`);
        stage3Result = await stage3GenerateLinks(bot, chatId);
        
        if (!stage3Result.success) {
          throw new Error(`Этап 3 завершился с ошибкой: ${stage3Result.error}`);
        }
      } else {
        console.log('✅ Этап 3 уже завершен');
      }
    }
    
    // ========== Итоговая статистика ==========
    if (collectionProcess.isRunning) {
      allData = await readDataFile();
      const completedNfts = allData.nfts.filter(nft => 
        nft.stage1_completed && nft.stage2_completed && nft.stage3_completed
      ).length;
      
      // Создаем итоговый файл
      await sendMessageWithDelay(bot, chatId, '📝 Создаю итоговый файл...');
      const summaryResult = await createSummaryFile();
      
      await sendMessageWithDelay(bot, chatId,
        `🎉 Сбор данных завершен!\n\n` +
        `📊 Всего NFT: ${allData.nfts.length}\n` +
        `✅ Полностью обработано: ${completedNfts}\n\n` +
        (summaryResult.success ? `📁 Итоговый файл создан` : `❌ Ошибка создания файла`)
      );
    }
    
  } catch (error) {
    console.error('❌ Ошибка в процессе сбора:', error);
    
    await sendMessageWithDelay(bot, chatId,
      `❌ Ошибка сбора данных\n\n` +
      `Этап: ${collectionProcess.currentStage}\n` +
      `Ошибка: ${error.message}`
    );
    
  } finally {
    // Очищаем процесс
    collectionProcess.isRunning = false;
    collectionProcess.currentStage = 0;
    collectionProcess.chatId = null;
    collectionProcess.bot = null;
  }
}

/**
 * Останавливает сбор данных и сохраняет прогресс
 */
async function stopCollection(bot, chatId) {
  if (!collectionProcess.isRunning) {
    await sendMessageWithDelay(bot, chatId, '⚠️ Сбор данных не запущен.');
    return;
  }

  // Останавливаем процесс
  collectionProcess.isRunning = false;

  await sendMessageWithDelay(bot, chatId,
    `🛑 Сбор данных остановлен\n\n` +
    `📊 Прогресс сохранен.\n` +
    `Текущий этап: ${collectionProcess.currentStage}`
  );
}

/**
 * Показывает статус сбора данных
 */
async function showCollectionStatus(bot, chatId) {
  try {
    const allData = await readDataFile();
    
    let statusMessage = `📊 Статус сбора данных\n\n`;
    
    if (collectionProcess.isRunning) {
      statusMessage += `🔄 Статус: Выполняется (этап ${collectionProcess.currentStage})\n`;
    } else {
      statusMessage += `🔄 Статус: Не активен\n`;
    }
    
    statusMessage += `📊 Всего NFT в коллекции: ${allData.collection_info.nft_quantity || 'неизвестно'}\n`;
    statusMessage += `📁 NFT в файле: ${allData.nfts.length}\n`;
    
    const stage1Count = allData.nfts.filter(n => n.stage1_completed).length;
    const stage2Count = allData.nfts.filter(n => n.stage2_completed).length;
    const stage3Count = allData.nfts.filter(n => n.stage3_completed).length;
    
    statusMessage += `\n🔄 Прогресс этапов:\n`;
    statusMessage += `1️⃣ Базовая информация: ${stage1Count}/${allData.nfts.length}\n`;
    statusMessage += `2️⃣ Детали: ${stage2Count}/${allData.nfts.length}\n`;
    statusMessage += `3️⃣ Ссылки: ${stage3Count}/${allData.nfts.length}\n`;
    
    if (allData.collection_info.last_updated) {
      const lastUpdated = new Date(allData.collection_info.last_updated);
      statusMessage += `\n🕒 Последнее обновление: ${lastUpdated.toLocaleString('ru-RU')}\n`;
    }
    
    await sendMessageWithDelay(bot, chatId, statusMessage, { parse_mode: undefined });
    
  } catch (error) {
    console.error('❌ Ошибка показа статуса:', error);
    await sendMessageWithDelay(bot, chatId, '❌ Ошибка загрузки статуса сбора.');
  }
}

/**
 * Команда для продолжения с текущего этапа
 */
async function continueCollection(bot, chatId) {
  try {
    const allData = await readDataFile();
    
    // Получаем актуальное количество NFT в коллекции
    const collectionInfo = await getCollectionInfo();
    if (!collectionInfo.success) {
      await sendMessageWithDelay(bot, chatId, `❌ Ошибка: ${collectionInfo.error}`);
      return;
    }
    
    const totalNfts = collectionInfo.totalNfts;
    const nftsInFile = allData.nfts.length;
    const lastProcessedIndex = allData.collection_info.last_processed_index || 0;
    
    // Определяем с какого этапа продолжать
    let startFromStage = 1;
    
    if (nftsInFile === 0) {
      startFromStage = 1;
    } else if (lastProcessedIndex < totalNfts) {
      startFromStage = 1;
    } else {
      const stage2Count = allData.nfts.filter(n => n.stage2_completed).length;
      const stage3Count = allData.nfts.filter(n => n.stage3_completed).length;
      
      if (stage2Count < nftsInFile) {
        startFromStage = 2;
      } else if (stage3Count < nftsInFile) {
        startFromStage = 3;
      } else {
        await sendMessageWithDelay(bot, chatId, `✅ Все этапы сбора данных уже завершены!`);
        return;
      }
    }
        
    // Запускаем сбор с нужного этапа
    await collectAllNfts(bot, chatId, { 
      startFromStage: startFromStage,
      batchSize: 100 
    });
    
  } catch (error) {
    console.error('❌ Ошибка продолжения сбора:', error);
    await sendMessageWithDelay(bot, chatId, `❌ Ошибка: ${error.message}`);
  }
}

module.exports = {
  collectAllNfts,
  stopCollection,
  showCollectionStatus,
  continueCollection,
  collectionProcess
};