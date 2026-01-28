const axios = require('axios');
const { TONAPI_KEY } = require('./utils.js');
const fs = require('fs').promises;
const path = require('path');

// Конфигурация для работы с лимитами API
const API_CONFIG = {
  maxRequestsPerMinute: 10,       // Максимум запросов в минуту для бесплатного тарифа
  requestsBeforePause: 5,         // Количество запросов перед паузой
  pauseDuration: 3000,            // Длительность паузы в миллисекундах (3 секунды)
  delayBetweenRequests: 100,      // Минимальная задержка между запросами
  maxRetries: 2,                  // Максимум повторных попыток при ошибке
  retryDelay: 2000                // Задержка перед повторной попыткой
};

/**
 * Проверяет, продается ли NFT через tonapi.io с обработкой ошибок 429
 */
async function checkNftOnSale(nftAddress, retryCount = 0) {
  try {
    const url = `https://tonapi.io/v2/nfts/${nftAddress}`;
    
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'SynergySortBot/1.0'
    };
    
    // Добавляем API ключ если он есть
    if (TONAPI_KEY) {
      headers['Authorization'] = `Bearer ${TONAPI_KEY}`;
    }
    
    const response = await axios.get(url, { 
      headers,
      timeout: 15000 
    });
    
    const nftData = response.data;
    
    // Проверяем наличие поля sale
    const isOnSale = nftData.sale !== undefined && nftData.sale !== null;
    
    // Извлекаем только нужные поля из цены
    let simplifiedPrice = null;
    if (isOnSale && nftData.sale.price) {
      simplifiedPrice = {
        value: nftData.sale.price.value,
        decimals: nftData.sale.price.decimals
      };
    }
    
    return {
      success: true,
      isOnSale: isOnSale,
      nftData: nftData,
      price: simplifiedPrice,
      saleInfo: isOnSale ? nftData.sale : null
    };
    
  } catch (error) {
    console.error(`❌ Ошибка проверки NFT ${nftAddress.substring(0, 20)}...:`, error.message);
    
    if (error.response) {
      console.error('   • Статус:', error.response.status);
      
      // Обработка ошибки 429 (Rate Limit)
      if (error.response.status === 429) {
        console.error('   • Ответ:', error.response.data);
        
        // Если не превысили лимит повторных попыток, ждем и пробуем снова
        if (retryCount < API_CONFIG.maxRetries) {
          const waitTime = API_CONFIG.retryDelay * (retryCount + 1);
          console.log(`   ⏳ Превышен лимит запросов. Жду ${waitTime/1000} секунд (попытка ${retryCount + 1}/${API_CONFIG.maxRetries})...`);
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Пробуем еще раз с увеличенным счетчиком попыток
          return await checkNftOnSale(nftAddress, retryCount + 1);
        } else {
          console.log(`   ❌ Превышено максимальное количество попыток для NFT ${nftAddress.substring(0, 20)}...`);
        }
      }
    }
    
    return {
      success: false,
      isOnSale: false,
      error: error.message,
      retryCount: retryCount
    };
  }
}

/**
 * Фильтрует NFT которые продаются с правильной паузой после каждых 5 запросов
 */
async function filterNftsOnSale(nfts) {
  console.log(`\n🚀 ПРОВЕРКА ${nfts.length} NFT НА ПРОДАЖУ`);
  console.log('═'.repeat(60));
  console.log(`📊 КОНФИГУРАЦИЯ ПАУЗ:`);
  console.log(`   • Пауза после каждых: ${API_CONFIG.requestsBeforePause} запросов`);
  console.log(`   • Длительность паузы: ${API_CONFIG.pauseDuration/1000} сек`);
  console.log(`   • Задержка между запросами: ${API_CONFIG.delayBetweenRequests} мс`);
  console.log(`   • Всего запросов: ${nfts.length}`);
  console.log(`   • Ожидается пауз: ${Math.floor((nfts.length - 1) / API_CONFIG.requestsBeforePause)}`);
  console.log('═'.repeat(60));
  
  const onSaleNfts = [];
  const checkedNfts = [];
  
  let totalChecked = 0;
  let totalOnSale = 0;
  let totalErrors = 0;
  let rateLimitErrors = 0;
  let requestCounter = 0; // Счетчик запросов для пауз
  
  console.log('\n▶️  НАЧИНАЮ ПРОВЕРКУ...\n');
  
  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];
    const currentRequestNumber = i + 1;
    
    // Выводим информацию о текущем запросе
    console.log(`${'─'.repeat(60)}`);
    console.log(`📝 ЗАПРОС ${currentRequestNumber}/${nfts.length}`);
    console.log(`   NFT #${nft.index || '?'}`);
    console.log(`   Адрес: ${nft.address.substring(0, 20)}...`);
    
    try {
      const result = await checkNftOnSale(nft.address);
      
      if (result.success && result.isOnSale) {
        // Создаем NFT с упрощенной информацией о цене
        const nftWithSaleInfo = {
          ...nft,
          on_sale: true,
          sale_price: result.price, // Только value и decimals
          checked_at: new Date().toISOString(),
          api_retries: result.retryCount || 0
        };
        
        // Удаляем полную информацию о продаже если она есть
        if (nftWithSaleInfo.sale_info) {
          delete nftWithSaleInfo.sale_info;
        }
        
        onSaleNfts.push(nftWithSaleInfo);
        totalOnSale++;
        checkedNfts.push(nftWithSaleInfo);
        
        // Форматируем информацию о цене
        let priceInfo = '';
        if (result.price && result.price.value) {
          const priceTon = (parseInt(result.price.value) / Math.pow(10, result.price.decimals || 9)).toFixed(2);
          priceInfo = ` - ${priceTon} TON`;
        }
        
        console.log(`   ✅ НА ПРОДАЖЕ${priceInfo}`);
        
      } else if (result.success) {
        // NFT не на продаже
        const nftWithoutSale = {
          ...nft,
          on_sale: false,
          checked_at: new Date().toISOString(),
          api_retries: result.retryCount || 0
        };
        checkedNfts.push(nftWithoutSale);
        console.log(`   ❌ НЕ ПРОДАЕТСЯ`);
        
      } else {
        // Ошибка при проверке
        totalErrors++;
        if (result.error && result.error.includes('429')) {
          rateLimitErrors++;
        }
        
        const nftWithError = {
          ...nft,
          on_sale: false,
          check_error: result.error,
          checked_at: new Date().toISOString(),
          api_retries: result.retryCount || 0
        };
        checkedNfts.push(nftWithError);
        console.log(`   ⚠️ ОШИБКА: ${result.error || 'Неизвестная ошибка'}`);
      }
      
      totalChecked++;
      
    } catch (error) {
      totalErrors++;
      totalChecked++;
      console.error(`   ❌ ИСКЛЮЧЕНИЕ: ${error.message}`);
      
      checkedNfts.push({
        ...nft,
        on_sale: false,
        check_error: error.message,
        checked_at: new Date().toISOString()
      });
    }
    
    // Пауза после каждых X запросов (кроме последнего)
    if (currentRequestNumber % API_CONFIG.requestsBeforePause === 0 && i < nfts.length - 1) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`⏸️  ПАУЗА (после ${API_CONFIG.requestsBeforePause} запросов)`);
      console.log(`   Проверено: ${currentRequestNumber}/${nfts.length} NFT`);
      console.log(`   На продаже: ${totalOnSale}`);
      console.log(`   Ошибок: ${totalErrors}`);
      console.log(`   Жду ${API_CONFIG.pauseDuration/1000} секунд...`);
      console.log(`${'─'.repeat(60)}\n`);
      
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.pauseDuration));
      
      console.log(`▶️  ПРОДОЛЖАЮ ПРОВЕРКУ...\n`);
    } else if (i < nfts.length - 1) {
      // Маленькая задержка между запросами
      console.log(`   ⏱️ Задержка ${API_CONFIG.delayBetweenRequests} мс...`);
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.delayBetweenRequests));
    }
  }
  
  console.log(`${'═'.repeat(60)}`);
  console.log(`🏁 ПРОВЕРКА ЗАВЕРШЕНА!`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`📊 ИТОГОВАЯ СТАТИСТИКА:`);
  console.log(`   • Всего проверено: ${totalChecked} NFT`);
  console.log(`   • На продаже: ${totalOnSale} NFT`);
  console.log(`   • Не продается: ${totalChecked - totalOnSale} NFT`);
  console.log(`   • Ошибок: ${totalErrors}`);
  console.log(`   • Ошибок 429 (лимит): ${rateLimitErrors}`);
  console.log(`   • Сделано пауз: ${Math.floor((nfts.length - 1) / API_CONFIG.requestsBeforePause)}`);
  console.log(`${'═'.repeat(60)}`);
  
  return {
    allChecked: checkedNfts,
    onSale: onSaleNfts,
    stats: {
      total: totalChecked,
      onSale: totalOnSale,
      notOnSale: totalChecked - totalOnSale,
      errors: totalErrors,
      rateLimitErrors: rateLimitErrors,
      totalRequests: nfts.length,
      pauses: Math.floor((nfts.length - 1) / API_CONFIG.requestsBeforePause),
      config: API_CONFIG
    }
  };
}

/**
 * Сохраняет отфильтрованные NFT в файл (перезаписывает существующий)
 */
async function saveFilteredOnSaleNfts(onSaleNfts, username, userId, filterParams = {}, stats = {}) {
  try {
    const safeUsername = (username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    
    // Сохраняем в ту же папку user_files
    const userFilesDir = path.join(__dirname, '../nft_data', 'user_files');
    
    // Фиксированное имя файла без времени (будет перезаписываться)
    const fileName = `Orc_filtered_onsale_${safeUsername}_${userId}.json`;
    const filePath = path.join(userFilesDir, fileName);
    
    // Форматируем данные: ТОЛЬКО цена в TON и юзерфрендли адрес NFT
    const simplifiedNfts = onSaleNfts
      .map(nft => {
        // Извлекаем цену в TON
        let priceTon = null;
        if (nft.sale_price && nft.sale_price.value) {
          const decimals = nft.sale_price.decimals || 9;
          priceTon = (parseInt(nft.sale_price.value) / Math.pow(10, decimals)).toFixed(2);
        }
        
        // Берем юзерфрендли адрес напрямую из данных NFT
        let userFriendlyAddress = null;
        
        // В порядке приоритета:
        // 1. user_friendly_address (есть в основном файле)
        // 2. friendly_address (альтернативное название)
        // 3. name (читаемое имя NFT)
        // 4. address (последний вариант)
        
        if (nft.user_friendly_address) {
          userFriendlyAddress = nft.user_friendly_address;
        } else if (nft.friendly_address) {
          userFriendlyAddress = nft.friendly_address;
        } else if (nft.name) {
          userFriendlyAddress = nft.name;
        } else if (nft.address) {
          userFriendlyAddress = nft.address;
        }
        
        // Возвращаем только если есть цена и юзерфрендли адрес
        if (priceTon && userFriendlyAddress) {
          return {
            price_ton: priceTon,
            nft_address: userFriendlyAddress
          };
        }
        return null;
      })
      .filter(nft => nft !== null); // Убираем null значения
    
    // Создаем минимальную структуру данных
    const dataToSave = {
      nfts: simplifiedNfts
    };
    
    // Создаем директорию если не существует
    await fs.mkdir(userFilesDir, { recursive: true });
    
    // Проверяем существовал ли файл раньше
    let existedPreviously = false;
    try {
      await fs.access(filePath);
      existedPreviously = true;
    } catch (error) {
      // Файл не существует
    }
    
    // Сохраняем в файл (перезаписываем)
    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
    
    console.log(`\n💾 ФАЙЛ NFT НА ПРОДАЖЕ ${existedPreviously ? 'ПЕРЕЗАПИСАН' : 'СОЗДАН'}`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`✅ Файл: ${fileName}`);
    console.log(`📁 Путь: ${filePath}`);
    console.log(`💰 NFT на продаже: ${simplifiedNfts.length}`);
    
    // Выводим примеры
    if (simplifiedNfts.length > 0) {
      console.log(`📋 Примеры (первые 3):`);
      simplifiedNfts.slice(0, 3).forEach((nft, i) => {
        console.log(`   ${i+1}. ${nft.nft_address} - ${nft.price_ton} TON`);
      });
    } else {
      console.log(`📭 Нет NFT на продаже для сохранения`);
      console.log(`   (Файл будет содержать пустой массив nfts: [])`);
    }
    
    console.log(`${'─'.repeat(50)}`);
    
    return {
      success: true,
      fileName: fileName,
      filePath: filePath,
      nftCount: simplifiedNfts.length,
      overwritten: existedPreviously
    };
    
  } catch (error) {
    console.error('❌ Ошибка сохранения файла NFT на продаже:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Основная функция для фильтрации NFT на продаже
 */
async function filterAndSaveOnSaleNfts(nfts, username, userId, filterParams = {}) {
  try {
    console.log(`\n🎯 ЗАПУСК ФИЛЬТРАЦИИ NFT НА ПРОДАЖУ`);
    console.log('═'.repeat(60));
    console.log(`📊 Исходное количество NFT: ${nfts.length}`);
    console.log(`👤 Пользователь: ${username || 'неизвестно'} (ID: ${userId})`);
    
    if (TONAPI_KEY) {
      console.log(`🔑 API ключ: используется`);
    } else {
      console.log(`⚠️ API ключ: не используется`);
      console.log(`   • Лимит: ${API_CONFIG.maxRequestsPerMinute} запросов/мин`);
      console.log(`   • Пауза после каждых ${API_CONFIG.requestsBeforePause} запросов`);
      console.log(`   • Длительность паузы: ${API_CONFIG.pauseDuration/1000} сек`);
    }
    
    console.log('═'.repeat(60));
    
    // Фильтруем NFT на продаже
    const filterResult = await filterNftsOnSale(nfts);
    
    console.log(`\n💰 НАЙДЕНО NFT НА ПРОДАЖЕ: ${filterResult.onSale.length}`);
    
    // Если есть NFT на продаже, сохраняем их
    if (filterResult.onSale.length > 0) {
      const saveResult = await saveFilteredOnSaleNfts(
        filterResult.onSale, 
        username, 
        userId, 
        filterParams,
        filterResult.stats
      );
      
      return {
        success: true,
        stats: filterResult.stats,
        saveResult: saveResult,
        nfts: filterResult.onSale
      };
    } else {
      console.log(`\nℹ️ NFT НА ПРОДАЖЕ НЕ НАЙДЕНЫ`);
      
      // Все равно сохраняем информацию о проверке (даже если нет NFT на продаже)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeUsername = (username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      const fileName = `Orc_filtered_onsale_${safeUsername}_${userId}_${timestamp}_empty.json`;
      const filePath = path.join(__dirname, '../nft_data', fileName);
      
      const emptyData = {
        metadata: {
          filename: fileName,
          created_at: new Date().toISOString(),
          user_id: userId,
          username: username,
          filter_type: 'on_sale',
          filter_params: filterParams,
          total_nfts: 0,
          note: 'NFT на продаже не найдены',
          api_stats: {
            config: API_CONFIG,
            processing_stats: filterResult.stats
          }
        },
        nfts: []
      };
      
      // Создаем директорию если не существует
      const dirPath = path.dirname(filePath);
      await fs.mkdir(dirPath, { recursive: true });
      
      await fs.writeFile(filePath, JSON.stringify(emptyData, null, 2), 'utf8');
      console.log(`📝 Создан файл с результатами проверки: ${fileName}`);
      
      return {
        success: true,
        stats: filterResult.stats,
        saveResult: {
          success: true,
          fileName: fileName,
          nftCount: 0,
          message: 'NFT на продаже не найдены'
        },
        nfts: [],
        message: 'NFT на продаже не найдены'
      };
    }
    
  } catch (error) {
    console.error('\n❌ ОШИБКА ФИЛЬТРАЦИИ:');
    console.error(error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Демонстрация работы системы пауз
 */
async function demonstratePauseSystem() {
  console.log('\n🧪 ДЕМОНСТРАЦИЯ СИСТЕМЫ ПАУЗ');
  console.log('═'.repeat(60));
  
  const demoNfts = [
    { index: 1, address: '0:DEMO1' },
    { index: 2, address: '0:DEMO2' },
    { index: 3, address: '0:DEMO3' },
    { index: 4, address: '0:DEMO4' },
    { index: 5, address: '0:DEMO5' },
    { index: 6, address: '0:DEMO6' },
    { index: 7, address: '0:DEMO7' },
    { index: 8, address: '0:DEMO8' },
    { index: 9, address: '0:DEMO9' },
    { index: 10, address: '0:DEMO10' },
    { index: 11, address: '0:DEMO11' },
    { index: 12, address: '0:DEMO12' }
  ];
  
  console.log('Демонстрация пауз после каждых 5 запросов:');
  console.log(`Всего NFT: ${demoNfts.length}`);
  console.log(`Ожидается пауз: ${Math.floor((demoNfts.length - 1) / 5)}`);
  console.log('═'.repeat(60));
  
  for (let i = 0; i < demoNfts.length; i++) {
    const nft = demoNfts[i];
    const currentRequest = i + 1;
    
    console.log(`📝 ЗАПРОС ${currentRequest}/${demoNfts.length}`);
    console.log(`   NFT #${nft.index}`);
    console.log(`   Адрес: ${nft.address}`);
    
    // Имитация запроса
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Пауза после каждых 5 запросов (кроме последнего)
    if (currentRequest % 5 === 0 && i < demoNfts.length - 1) {
      console.log('\n⏸️  ПАУЗА (после 5 запросов)');
      console.log('   Жду 3 секунды...');
      console.log('─'.repeat(60));
      
      // В демо используем короткую паузу
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('\n▶️  ПРОДОЛЖАЮ...\n');
    } else if (i < demoNfts.length - 1) {
      console.log('   ⏱️ Задержка 100 мс...\n');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('═'.repeat(60));
  console.log('✅ ДЕМОНСТРАЦИЯ ЗАВЕРШЕНА');
  console.log('═'.repeat(60));
  
  return {
    success: true,
    message: 'Демонстрация завершена'
  };
}

module.exports = {
  checkNftOnSale,
  filterNftsOnSale,
  saveFilteredOnSaleNfts,
  filterAndSaveOnSaleNfts,
  demonstratePauseSystem,
  API_CONFIG
};