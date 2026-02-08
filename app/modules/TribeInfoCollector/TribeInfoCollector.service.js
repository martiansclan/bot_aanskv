
const fs = require('fs').promises;
const path = require('path');
const CONSTANTS = require('./TribeInfoCollector.constants');
const utils = require('./TribeInfoCollector.utils');

class TribeInfoCollectorService {
    constructor() {
        this.config = require('./TribeInfoCollector.config');
        this.constants = CONSTANTS;
        this.utils = utils;
        
        // Состояние процесса сбора
        this.collectionProcess = {
            isRunning: false,
            calculationId: null,
            lastProgressUpdate: null
        };
        
        // Хранилище прогресса для polling
        this.progressStore = new Map();
        
        // Кеш для данных
        this.dataCache = null;
        this.cacheTimestamp = null;
        this.cacheTimeout = 5000;
        
        this.logger = {
            info: (msg, ...args) => console.log(`[${CONSTANTS.LOG_TAGS.INFO}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args),
            error: (msg, ...args) => console.error(`[${CONSTANTS.LOG_TAGS.ERROR}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args),
            warn: (msg, ...args) => console.warn(`[${CONSTANTS.LOG_TAGS.WARN}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args)
        };
    }

    /**
     * Получает путь к файлу данных
     */
    getDataFilePath() {
        return this.config.dataFile.nftData;
    }

    /**
     * Создает структуру данных
     */
    createDataStructure() {
        return {
            [CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]: {
                [CONSTANTS.COLLECTION_KEYS.COLLECTION_NAME]: 'Unknown Collection',
                [CONSTANTS.COLLECTION_KEYS.COLLECTION_ADDRESS]: this.config.collectionAddress,
                [CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY]: 0,
                [CONSTANTS.COLLECTION_KEYS.LAST_UPDATED]: null,
                [CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX]: 0
            },
            [CONSTANTS.COLLECTION_KEYS.NFTS]: []
        };
    }

    /**
     * Читает данные из файла
     */
    async readDataFile(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.dataCache && this.cacheTimestamp && 
            (now - this.cacheTimestamp) < this.cacheTimeout) {
            return this.dataCache;
        }
        
        const filePath = this.getDataFilePath();
        
        try {
            await fs.access(filePath);
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            
            this.dataCache = data;
            this.cacheTimestamp = Date.now();
            
            return data;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.info('📁 Файл данных не найден, создаю новый...');
                const newData = this.createDataStructure();
                
                // Создаем директорию если не существует
                const dirPath = path.dirname(filePath);
                try {
                    await fs.mkdir(dirPath, { recursive: true });
                } catch (mkdirError) {
                    // Директория уже существует, это нормально
                }
                
                await fs.writeFile(filePath, JSON.stringify(newData, null, 2), 'utf8');
                this.logger.info(`✅ Создан файл данных: ${path.basename(filePath)}`);
                
                this.dataCache = newData;
                this.cacheTimestamp = Date.now();
                
                return newData;
            }
            
            this.logger.error('❌ Ошибка чтения файла данных:', error.message);
            throw new Error(CONSTANTS.ERROR_MESSAGES.FILE_READ_ERROR);
        }
    }

    /**
     * Записывает данные в файл
     */
    async writeDataFile(data) {
        const filePath = this.getDataFilePath();
        
        try {
            // Обновляем время последнего обновления
            data[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_UPDATED] = 
                new Date().toISOString();
            
            // Преобразуем данные в JSON с форматированием
            const jsonContent = JSON.stringify(data, null, 2);
            
            // Пишем во временный файл сначала
            const tempPath = filePath + '.tmp';
            await fs.writeFile(tempPath, jsonContent, 'utf8');
            
            // Проверяем что файл валидный
            await fs.readFile(tempPath, 'utf8').then(content => JSON.parse(content));
            
            // Заменяем старый файл новым
            await fs.rename(tempPath, filePath);
            
            // Обновляем кеш
            this.dataCache = data;
            this.cacheTimestamp = Date.now();
            
            return { success: true, filePath };
            
        } catch (error) {
            this.logger.error('❌ Ошибка записи в файл данных:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получает информацию о коллекции
     */
    async getCollectionInfo() {
        return await this.utils.getCollectionInfo(this.config.collectionAddress);
    }

    /**
     * Извлекает данные из ответа API и создает запись NFT
     */
    extractNftDataFromResponse(nftItem, response) {
        try {
            const nftIndex = parseInt(nftItem.index || '0');
            const nftAddress = nftItem.address;
            const ownerAddress = nftItem.owner_address || nftItem.owner?.address || '';
            
            // 1. Ищем user-friendly адрес NFT в address_book
            let userFriendlyAddress = nftAddress;
            if (response.address_book && response.address_book[nftAddress]) {
                const addressData = response.address_book[nftAddress];
                if (addressData.interfaces && addressData.interfaces.includes('nft_item')) {
                    userFriendlyAddress = addressData.user_friendly || nftAddress;
                }
            }
            
            // 2. Ищем метаданные NFT в metadata
            let name = 'Не указано';
            let imageUrl = '';
            let attributes = [];
            
            if (response.metadata && response.metadata[nftAddress]) {
                const metadata = response.metadata[nftAddress];
                
                if (metadata.token_info && metadata.token_info.length > 0) {
                    const tokenInfo = metadata.token_info[0];
                    
                    if (tokenInfo.type === 'nft_items') {
                        name = tokenInfo.name || 'Не указано';
                        
                        if (tokenInfo.extra && tokenInfo.extra._image_medium) {
                            imageUrl = tokenInfo.extra._image_medium;
                        } else {
                            imageUrl = tokenInfo.image || '';
                        }
                        
                        if (tokenInfo.extra && tokenInfo.extra.attributes) {
                            attributes = tokenInfo.extra.attributes;
                        }
                    }
                }
            }
            
            // 3. Формируем ссылки
            const collectionUserFriendly = this.config.collectionAddress;
            const getgemsUrl = `https://getgems.io/collection/${collectionUserFriendly}/${userFriendlyAddress}`;
            
            let ownerUrl = '';
            if (ownerAddress && ownerAddress.trim() !== '') {
                ownerUrl = `https://getgems.io/user/${ownerAddress}`;
            }
            
            // 4. Создаем объект NFT
            return {
                [CONSTANTS.NFT_KEYS.INDEX]: nftIndex,
                [CONSTANTS.NFT_KEYS.ADDRESS]: nftAddress,
                [CONSTANTS.NFT_KEYS.OWNER_ADDRESS]: ownerAddress,
                [CONSTANTS.NFT_KEYS.USER_FRIENDLY_ADDRESS]: userFriendlyAddress,
                [CONSTANTS.NFT_KEYS.NAME]: name,
                [CONSTANTS.NFT_KEYS.IMAGE_URL]: imageUrl,
                [CONSTANTS.NFT_KEYS.ATTRIBUTES]: attributes,
                [CONSTANTS.NFT_KEYS.GETGEMS_URL]: getgemsUrl,
                [CONSTANTS.NFT_KEYS.OWNER_URL]: ownerUrl,
                collected_at: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error(`❌ Ошибка извлечения данных для NFT ${nftItem.index}:`, error.message);
            throw error;
        }
    }

    /**
     * Основной метод: Сбор всех данных из одного запроса
     */
    async collectAllNfts(options = {}) {
        const {
            calculationId = `collect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        } = options;

        if (this.collectionProcess.isRunning) {
            throw new Error(CONSTANTS.ERROR_MESSAGES.PROCESS_ALREADY_RUNNING);
        }

        try {
            // Устанавливаем флаги процесса
            this.collectionProcess.isRunning = true;
            this.collectionProcess.calculationId = calculationId;
            
            this.logger.info(`🚀 Запуск сбора данных (ID: ${calculationId})`);

            // Сохраняем начальный прогресс
            this.updateProgressStore(
                'in_progress',
                0,
                0,
                'Начинаю сбор данных...',
                { calculationId, startedAt: new Date().toISOString() }
            );

            // Читаем текущие данные
            let allData = await this.readDataFile();
            
            // Получаем актуальное количество NFT
            const collectionInfo = await this.utils.getCollectionInfo(this.config.collectionAddress);
            if (!collectionInfo.success) {
                throw new Error(collectionInfo.error);
            }
            
            const totalNfts = collectionInfo.totalNfts;
            const collectionName = collectionInfo.collectionName;
            
            // Обновляем информацию о коллекции в данных
            allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.COLLECTION_NAME] = collectionName;
            allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.COLLECTION_ADDRESS] = this.config.collectionAddress;
            
            // Определяем с какого места начинать
            // last_processed_index - это ПОСЛЕДНИЙ успешно обработанный индекс
            // Если еще ничего не обработано, начинаем с 0
            const lastProcessedIndex = allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] || -1;
            
            // Стартовый индекс для обработки = последний обработанный + 1
            let startOffset = lastProcessedIndex + 1;
            
            // Если уже все NFT обработаны
            if (startOffset >= totalNfts) {
                this.logger.info(`✅ Все NFT уже обработаны (последний индекс: ${lastProcessedIndex}, всего: ${totalNfts})`);
                
                // Обновляем информацию о коллекции
                allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] = totalNfts;
                await this.writeDataFile(allData);
                
                this.updateProgressStore(
                    'completed',
                    totalNfts,
                    totalNfts,
                    `Сбор данных завершен (все NFT уже были обработаны)`,
                    { 
                        success: true,
                        calculationId,
                        timestamp: new Date().toISOString(),
                        statistics: {
                            totalNfts: totalNfts,
                            nftsInFile: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
                            processed: 0
                        }
                    }
                );
                
                return {
                    success: true,
                    message: 'Все NFT уже обработаны',
                    calculationId,
                    timestamp: new Date().toISOString()
                };
            }
            
            const remaining = totalNfts - startOffset;
            this.logger.info(`🔄 Начинаю обработку ${remaining} NFT (начиная с индекса: ${startOffset}, всего: ${totalNfts})`);
            this.logger.info(`📊 Последний обработанный индекс был: ${lastProcessedIndex}, начинаю с: ${startOffset}`);
            
            this.updateProgressStore(
                'in_progress',
                0,
                remaining,
                `Начинаю обработку ${remaining} NFT, начиная с индекса ${startOffset}`
            );
            
            const batchSize = this.config.collectionSettings.batchSize;
            let currentOffset = startOffset; // Текущий offset для API запросов
            let batchNumber = Math.floor(currentOffset / batchSize);
            let totalProcessed = 0;
            let iterations = 0;
            
            while (currentOffset < totalNfts && this.collectionProcess.isRunning) {
                iterations++;
                batchNumber++;
                
                const limit = Math.min(batchSize, totalNfts - currentOffset);
                
                // Логируем прогресс
                if (iterations <= 3 || batchNumber % 10 === 0 || limit < batchSize) {
                    this.logger.info(`📦 Пачка ${batchNumber}: offset=${currentOffset}, лимит=${limit}, обработано=${totalProcessed}/${remaining}`);
                    
                    this.updateProgressStore(
                        'in_progress',
                        totalProcessed,
                        remaining,
                        `Обработано ${totalProcessed}/${remaining} NFT`
                    );
                }
                
                // Получаем пачку NFT
                const response = await this.utils.getNftItems(this.config.collectionAddress, limit, currentOffset);
                
                if (!response.success) {
                    throw new Error(`Ошибка API на offset ${currentOffset}: ${response.error}`);
                }
                
                if (!response.nft_items || response.nft_items.length === 0) {
                    this.logger.warn(`⚠️ Пустая пачка на offset ${currentOffset}, прерываю цикл`);
                    break;
                }
                
                this.logger.info(`📥 Получено ${response.nft_items.length} NFT, есть address_book: ${!!response.address_book}, есть metadata: ${!!response.metadata}`);
                
                // Обрабатываем каждый NFT
                for (const nftItem of response.nft_items) {
                    if (!this.collectionProcess.isRunning) break;
                    
                    const nftIndex = parseInt(nftItem.index || '0');
                    
                    try {
                        // Извлекаем все данные из ответа
                        const nftData = this.extractNftDataFromResponse(nftItem, response);
                        
                        // Проверяем, есть ли уже такой NFT
                        const existingIndex = allData[CONSTANTS.COLLECTION_KEYS.NFTS].findIndex(nft => 
                            nft[CONSTANTS.NFT_KEYS.ADDRESS] === nftItem.address || 
                            nft[CONSTANTS.NFT_KEYS.INDEX] === nftIndex
                        );
                        
                        if (existingIndex === -1) {
                            // Добавляем новую запись
                            allData[CONSTANTS.COLLECTION_KEYS.NFTS].push(nftData);
                            
                            // Логируем первые 3 NFT для отладки
                            if (iterations === 1 && allData[CONSTANTS.COLLECTION_KEYS.NFTS].length <= 3) {
                                this.logger.info(`✅ Добавлен NFT ${nftIndex}: "${nftData[CONSTANTS.NFT_KEYS.NAME]}"`);
                            }
                        } else {
                            // Обновляем существующую запись
                            allData[CONSTANTS.COLLECTION_KEYS.NFTS][existingIndex] = nftData;
                        }
                        
                    } catch (error) {
                        this.logger.error(`❌ Ошибка обработки NFT ${nftIndex}:`, error.message);
                        // Продолжаем обработку других NFT
                    }
                }
                
                // Обновляем offset для следующего запроса
                const processedInThisBatch = response.nft_items.length;
                currentOffset += processedInThisBatch;
                totalProcessed += processedInThisBatch;
                
                // Обновляем последний обработанный индекс (самый большой индекс в этой пачке)
                // Ищем максимальный индекс в этой пачке
                const maxIndexInBatch = Math.max(...response.nft_items.map(item => parseInt(item.index || '0')));
                allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] = maxIndexInBatch;
                
                // Обновляем общее количество в коллекции
                allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] = totalNfts;
                
                // Сохраняем прогресс каждые 500 NFT или если это последняя пачка
                if (totalProcessed % 500 === 0 || currentOffset >= totalNfts) {
                    await this.writeDataFile(allData);
                    this.logger.info(`💾 Сохранено после ${totalProcessed} NFT, последний индекс: ${maxIndexInBatch}`);
                }
                
                // Задержка между пачками
                if (this.collectionProcess.isRunning && currentOffset < totalNfts) {
                    await this.utils.sleep(this.config.collectionSettings.delayBetweenBatches);
                }
            }
            
            // Проверяем почему вышли из цикла
            if (!this.collectionProcess.isRunning) {
                this.logger.warn(`🛑 Сбор остановлен пользователем, обработано: ${totalProcessed} NFT`);
            } else {
                this.logger.info(`✅ Сбор завершен, обработано: ${totalProcessed} NFT`);
            }
            
            // Финальное сохранение и сортировка
            allData[CONSTANTS.COLLECTION_KEYS.NFTS].sort((a, b) => a[CONSTANTS.NFT_KEYS.INDEX] - b[CONSTANTS.NFT_KEYS.INDEX]);
            await this.writeDataFile(allData);
            
            // Подсчитываем статистику
            const nftsWithNames = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(nft => 
                nft[CONSTANTS.NFT_KEYS.NAME] && nft[CONSTANTS.NFT_KEYS.NAME] !== 'Не указано'
            ).length;
            
            const nftsWithImages = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(nft => 
                nft[CONSTANTS.NFT_KEYS.IMAGE_URL] && nft[CONSTANTS.NFT_KEYS.IMAGE_URL].trim() !== ''
            ).length;
            
            // Получаем последний обработанный индекс
            const lastIndexInFile = allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX];
            
            // Финальный результат
            const finalResult = {
                success: true,
                message: this.collectionProcess.isRunning ? 'Сбор данных успешно завершен' : 'Сбор данных остановлен',
                calculationId,
                timestamp: new Date().toISOString(),
                statistics: {
                    totalNftsInCollection: totalNfts,
                    totalNftsInFile: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
                    processed: totalProcessed,
                    nftsWithNames: nftsWithNames,
                    nftsWithImages: nftsWithImages,
                    lastProcessedIndex: lastIndexInFile,
                    expectedLastIndex: totalNfts - 1, // Если индексы с 0 до N-1
                    allIndicesCollected: (lastIndexInFile === (totalNfts - 1))
                },
                file: {
                    path: this.getDataFilePath(),
                    size: null,
                    nftCount: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length
                }
            };
            
            // Получаем размер файла
            try {
                const stats = await fs.stat(this.getDataFilePath());
                finalResult.file.size = stats.size;
                finalResult.file.sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            } catch (error) {
                // Игнорируем ошибку получения размера файла
            }
            
            // Сохраняем финальный прогресс
            this.updateProgressStore(
                this.collectionProcess.isRunning ? 'completed' : 'stopped',
                totalProcessed,
                remaining,
                this.collectionProcess.isRunning ? 'Сбор данных завершен!' : 'Сбор данных остановлен',
                finalResult
            );
            
            this.logger.info(`🎉 ${finalResult.message} (ID: ${calculationId})`);
            this.logger.info(`📊 Статистика:`);
            this.logger.info(`   Всего NFT в коллекции: ${finalResult.statistics.totalNftsInCollection}`);
            this.logger.info(`   NFT в файле: ${finalResult.statistics.totalNftsInFile}`);
            this.logger.info(`   Обработано в этом запуске: ${finalResult.statistics.processed}`);
            this.logger.info(`   NFT с именами: ${finalResult.statistics.nftsWithNames}`);
            this.logger.info(`   NFT с изображениями: ${finalResult.statistics.nftsWithImages}`);
            this.logger.info(`   Последний обработанный индекс: ${finalResult.statistics.lastProcessedIndex}`);
            this.logger.info(`   Ожидаемый последний индекс: ${finalResult.statistics.expectedLastIndex}`);
            this.logger.info(`   Все индексы собраны: ${finalResult.statistics.allIndicesCollected ? '✅ Да' : '❌ Нет'}`);
            
            return finalResult;
            
        } catch (error) {
            this.logger.error('❌ Ошибка в процессе сбора данных:', error);
            
            const errorResult = {
                success: false,
                message: 'Ошибка сбора данных',
                calculationId: this.collectionProcess.calculationId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            this.updateProgressStore(
                'error',
                0,
                0,
                `Ошибка: ${error.message}`,
                errorResult
            );
            
            throw error;
            
        } finally {
            // Очищаем состояние процесса
            const wasRunning = this.collectionProcess.isRunning;
            const lastCalculationId = this.collectionProcess.calculationId;
            
            this.collectionProcess.isRunning = false;
            this.collectionProcess.calculationId = null;
            
            if (wasRunning) {
                this.logger.info(`🛑 Процесс сбора остановлен (ID: ${lastCalculationId})`);
            }
        }
    }

    /**
     * Останавливает сбор данных
     */
    async stopCollection() {
        if (!this.collectionProcess.isRunning) {
            throw new Error(CONSTANTS.ERROR_MESSAGES.PROCESS_NOT_RUNNING);
        }

        const currentCalculationId = this.collectionProcess.calculationId;
        
        // Устанавливаем флаг остановки
        this.collectionProcess.isRunning = false;
        
        this.logger.info(`🛑 Остановка сбора данных (ID: ${currentCalculationId})`);
        
        // Сохраняем прогресс остановки
        this.updateProgressStore(
            'stopped',
            0,
            0,
            'Сбор данных остановлен пользователем',
            {
                calculationId: currentCalculationId,
                stoppedByUser: true,
                timestamp: new Date().toISOString(),
                canContinue: true
            }
        );
        
        return {
            success: true,
            message: CONSTANTS.SUCCESS_MESSAGES.PROCESS_STOPPED,
            calculationId: currentCalculationId,
            timestamp: new Date().toISOString(),
            canContinue: true
        };
    }

    /**
     * Показывает статус сбора данных
     */
    async getCollectionStatus() {
        try {
            const allData = await this.readDataFile();
            
            return {
                isRunning: this.collectionProcess.isRunning,
                calculationId: this.collectionProcess.calculationId,
                collectionInfo: {
                    collectionName: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.COLLECTION_NAME] || 'Неизвестно',
                    collectionAddress: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.COLLECTION_ADDRESS],
                    totalInCollection: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] || 0,
                    nftsInFile: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
                    lastUpdated: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_UPDATED],
                    lastProcessedIndex: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX]
                },
                statistics: {
                    nftsWithNames: allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => 
                        n[CONSTANTS.NFT_KEYS.NAME] && n[CONSTANTS.NFT_KEYS.NAME] !== 'Не указано'
                    ).length,
                    nftsWithImages: allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => 
                        n[CONSTANTS.NFT_KEYS.IMAGE_URL] && n[CONSTANTS.NFT_KEYS.IMAGE_URL].trim() !== ''
                    ).length
                }
            };
            
        } catch (error) {
            this.logger.error('❌ Ошибка получения статуса:', error.message);
            
            return {
                isRunning: this.collectionProcess.isRunning,
                calculationId: this.collectionProcess.calculationId,
                collectionInfo: {
                    collectionName: 'Неизвестно',
                    collectionAddress: this.config.collectionAddress,
                    totalInCollection: 0,
                    nftsInFile: 0,
                    lastUpdated: null,
                    lastProcessedIndex: 0
                },
                error: error.message
            };
        }
    }

    /**
     * Обновляет хранилище прогресса для polling
     */
    updateProgressStore(status, processed, total, message, details = {}) {
        try {
            const calculationId = this.collectionProcess.calculationId;
            
            if (!calculationId) {
                return;
            }
            
            const progressData = {
                calculationId,
                status,
                processed,
                total,
                message,
                details,
                timestamp: new Date().toISOString()
            };
            
            // Сохраняем в хранилище
            this.progressStore.set(calculationId, progressData);
            
            // Обновляем время последнего обновления
            this.collectionProcess.lastProgressUpdate = Date.now();
            
        } catch (error) {
            this.logger.error('❌ Ошибка обновления прогресса:', error.message);
        }
    }

    /**
     * Получает текущий прогресс для calculationId
     */
    getProgress(calculationId) {
        const progress = this.progressStore.get(calculationId);
        
        if (!progress) {
            return {
                calculationId,
                status: 'not_found',
                message: 'Прогресс не найден',
                timestamp: new Date().toISOString()
            };
        }
        
        return progress;
    }

    /**
     * Проверяет файл данных
     */
    async checkFile() {
        const filePath = this.getDataFilePath();
        
        try {
            await fs.access(filePath);
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf8');
            
            let data;
            let isValidJson = true;
            try {
                data = JSON.parse(content);
            } catch (error) {
                isValidJson = false;
                data = {};
            }
            
            return {
                exists: true,
                path: filePath,
                size: stats.size,
                sizeMB: (stats.size / 1024 / 1024).toFixed(2),
                nftCount: data[CONSTANTS.COLLECTION_KEYS.NFTS]?.length || 0,
                lastModified: stats.mtime,
                isValidJson: isValidJson,
                structure: {
                    hasCollectionInfo: !!data[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO],
                    hasNfts: !!data[CONSTANTS.COLLECTION_KEYS.NFTS],
                    collectionInfoFields: data[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO] ? 
                        Object.keys(data[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]) : []
                }
            };
            
        } catch (error) {
            return {
                exists: false,
                path: filePath,
                error: error.message
            };
        }
    }

    /**
     * Проверяет целостность данных и автоматически дополняет отсутствующие NFT
     */
    async checkDataIntegrity(autoFill = true) {
        try {
            this.logger.info('🔍 Проверка целостности данных...');
            
            // Читаем данные с принудительным обновлением
            const allData = await this.readDataFile(true);
            
            if (!allData[CONSTANTS.COLLECTION_KEYS.NFTS] || allData[CONSTANTS.COLLECTION_KEYS.NFTS].length === 0) {
                this.logger.info('ℹ️ Нет NFT в файле, проверка не требуется');
                return { 
                    success: true, 
                    message: 'Файл пуст, проверка не требуется',
                    nftCount: 0,
                    missingIndices: [],
                    autoFilled: false
                };
            }
            
            // Получаем информацию о коллекции для сравнения
            const collectionInfo = await this.utils.getCollectionInfo(this.config.collectionAddress);
            if (!collectionInfo.success) {
                this.logger.warn('⚠️ Не удалось получить информацию о коллекции, использую данные из файла');
            }
            
            // Собираем все индексы из файла
            const allIndices = new Set();
            const indicesInFile = [];
            
            for (const nft of allData[CONSTANTS.COLLECTION_KEYS.NFTS]) {
                const index = nft[CONSTANTS.NFT_KEYS.INDEX];
                allIndices.add(index);
                indicesInFile.push(index);
            }
            
            // Сортируем индексы для анализа
            indicesInFile.sort((a, b) => a - b);
            
            // Находим минимальный и максимальный индекс
            const minIndex = Math.min(...indicesInFile);
            const maxIndex = Math.max(...indicesInFile);
            
            // Получаем last_processed_index из файла
            const lastProcessedIndex = allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX];
            
            // Определяем диапазон для проверки
            const expectedMaxIndex = collectionInfo.success ? (collectionInfo.totalNfts - 1) : lastProcessedIndex;
            const checkToIndex = Math.max(maxIndex, expectedMaxIndex, lastProcessedIndex);
            
            // Ищем отсутствующие индексы
            const missingIndices = [];
            const duplicateIndices = [];
            
            // Проверяем дубликаты
            const indexCount = {};
            for (const index of indicesInFile) {
                indexCount[index] = (indexCount[index] || 0) + 1;
            }
            
            for (const [index, count] of Object.entries(indexCount)) {
                if (count > 1) {
                    duplicateIndices.push({ index: parseInt(index), count });
                }
            }
            
            // Проверяем отсутствующие индексы в диапазоне
            for (let i = 0; i <= checkToIndex; i++) {
                if (!allIndices.has(i)) {
                    missingIndices.push(i);
                }
            }
            
            // Группируем отсутствующие индексы для лучшего отображения
            const missingRanges = [];
            if (missingIndices.length > 0) {
                let start = missingIndices[0];
                let end = missingIndices[0];
                
                for (let i = 1; i < missingIndices.length; i++) {
                    if (missingIndices[i] === end + 1) {
                        end = missingIndices[i];
                    } else {
                        if (start === end) {
                            missingRanges.push(`${start}`);
                        } else {
                            missingRanges.push(`${start}-${end}`);
                        }
                        start = missingIndices[i];
                        end = missingIndices[i];
                    }
                }
                
                // Добавляем последний диапазон
                if (start === end) {
                    missingRanges.push(`${start}`);
                } else {
                    missingRanges.push(`${start}-${end}`);
                }
            }
            
            // Показательный вывод в консоль
            console.log('\n' + '='.repeat(80));
            console.log('🔍 РЕЗУЛЬТАТЫ ПРОВЕРКИ ЦЕЛОСТНОСТИ ДАННЫХ');
            console.log('='.repeat(80));
            
            console.log(`📁 Файл: ${path.basename(this.getDataFilePath())}`);
            console.log(`📊 Всего NFT в файле: ${indicesInFile.length}`);
            console.log(`🎯 Диапазон индексов в файле: ${minIndex} - ${maxIndex}`);
            console.log(`🏷️ last_processed_index: ${lastProcessedIndex}`);
            
            if (collectionInfo.success) {
                console.log(`🏛️ Всего NFT в коллекции (по API): ${collectionInfo.totalNfts}`);
                console.log(`🎯 Ожидаемый последний индекс: ${expectedMaxIndex}`);
            }
            
            console.log('\n' + '-'.repeat(80));
            
            if (duplicateIndices.length > 0) {
                console.log('⚠️  НАЙДЕНЫ ДУБЛИКАТЫ ИНДЕКСОВ:');
                for (const dup of duplicateIndices) {
                    console.log(`   Индекс ${dup.index}: ${dup.count} записей`);
                }
                console.log('');
            } else {
                console.log('✅ Дубликатов индексов не найдено');
            }
            
            let fillResult = null;
            
            if (missingIndices.length > 0) {
                console.log(`❌ ОТСУТСТВУЮЩИЕ ИНДЕКСЫ (${missingIndices.length} шт.):`);
                console.log(`   Всего отсутствует: ${missingIndices.length} индексов`);
                
                if (missingRanges.length <= 20) {
                    console.log(`   Диапазоны: ${missingRanges.join(', ')}`);
                } else {
                    console.log(`   Первые 20 диапазонов: ${missingRanges.slice(0, 20).join(', ')}...`);
                    console.log(`   ...и еще ${missingRanges.length - 20} диапазонов`);
                }
                
                // Процент заполненности
                const totalExpected = checkToIndex + 1;
                const completeness = ((indicesInFile.length / totalExpected) * 100).toFixed(2);
                console.log(`   Заполненность данных: ${indicesInFile.length}/${totalExpected} (${completeness}%)`);
                
                // Автоматическое дополнение если включено
                if (autoFill && missingIndices.length > 0) {
                    console.log('\n' + '-'.repeat(80));
                    console.log('🔄 АВТОМАТИЧЕСКОЕ ДОПОЛНЕНИЕ ОТСУТСТВУЮЩИХ NFT');
                    console.log('-'.repeat(80));
                    
                    fillResult = await this.fillMissingNfts(missingIndices);
                    
                    console.log('='.repeat(80));
                }
                
            } else {
                console.log('✅ Все индексы в диапазоне присутствуют');
                
                if (indicesInFile.length > 0) {
                    const totalExpected = checkToIndex + 1;
                    if (indicesInFile.length === totalExpected) {
                        console.log(`   ✅ Идеальная заполненность: ${indicesInFile.length}/${totalExpected} (100%)`);
                    } else {
                        const completeness = ((indicesInFile.length / totalExpected) * 100).toFixed(2);
                        console.log(`   ℹ️ Заполненность: ${indicesInFile.length}/${totalExpected} (${completeness}%)`);
                        console.log(`   ℹ️ В файле есть индексы за пределами ожидаемого диапазона`);
                    }
                }
            }
            
            console.log('\n' + '-'.repeat(80));
            
            // Проверяем последовательность
            let isSequential = true;
            for (let i = 0; i < indicesInFile.length - 1; i++) {
                if (indicesInFile[i + 1] !== indicesInFile[i] + 1) {
                    isSequential = false;
                    break;
                }
            }
            
            if (isSequential && indicesInFile.length > 1) {
                console.log('✅ Индексы идут последовательно');
            } else if (indicesInFile.length > 1) {
                console.log('⚠️ Индексы НЕ идут последовательно');
                
                // Находим разрывы в последовательности индексов, которые есть в файле
                const gapsInFile = [];
                for (let i = 0; i < indicesInFile.length - 1; i++) {
                    if (indicesInFile[i + 1] > indicesInFile[i] + 1) {
                        gapsInFile.push(`${indicesInFile[i] + 1}...${indicesInFile[i + 1] - 1}`);
                    }
                }
                
                if (gapsInFile.length > 0) {
                    console.log(`   Разрывы между имеющимися индексами: ${gapsInFile.join(', ')}`);
                }
            }
            
            console.log('='.repeat(80) + '\n');
            
            // Возвращаем результат
            return {
                success: true,
                message: missingIndices.length === 0 ? 'Целостность данных проверена: все индексы присутствуют' : 
                         fillResult ? 'Проверка целостности выполнена, отсутствующие NFT дополнены' : 
                         'Найдены отсутствующие индексы',
                statistics: {
                    nftCount: indicesInFile.length,
                    minIndex: minIndex,
                    maxIndex: maxIndex,
                    lastProcessedIndex: lastProcessedIndex,
                    expectedMaxIndex: expectedMaxIndex,
                    totalCheckedRange: checkToIndex + 1,
                    missingCount: missingIndices.length,
                    duplicateCount: duplicateIndices.length,
                    completeness: indicesInFile.length / (checkToIndex + 1)
                },
                missingIndices: missingIndices,
                missingRanges: missingRanges,
                duplicateIndices: duplicateIndices,
                isSequential: isSequential,
                fillResult: fillResult,
                autoFilled: fillResult !== null
            };
            
        } catch (error) {
            this.logger.error('❌ Ошибка проверки целостности данных:', error.message);
            
            // Выводим ошибку в консоль
            console.error('\n' + '='.repeat(80));
            console.error('❌ ОШИБКА ПРОВЕРКИ ЦЕЛОСТНОСТИ');
            console.error('='.repeat(80));
            console.error(`Ошибка: ${error.message}`);
            console.error('='.repeat(80) + '\n');
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Дополняет файл отсутствующими NFT по индексам
     */
    async fillMissingNfts(missingIndices, calculationId = null) {
        try {
            if (!calculationId) {
                calculationId = `fill_missing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            
            this.logger.info(`🔄 Начинаю дополнение ${missingIndices.length} отсутствующих NFT (ID: ${calculationId})`);
            
            // Сохраняем прогресс
            this.updateProgressStore(
                'in_progress',
                0,
                missingIndices.length,
                `Начинаю дополнение ${missingIndices.length} отсутствующих NFT`,
                { calculationId, startedAt: new Date().toISOString() }
            );
            
            // Читаем текущие данные
            const allData = await this.readDataFile();
            
            // Сортируем индексы для удобства
            const sortedIndices = [...missingIndices].sort((a, b) => a - b);
            
            let totalFilled = 0;
            let totalErrors = 0;
            
            // Обрабатываем каждый отсутствующий индекс отдельно
            for (let i = 0; i < sortedIndices.length; i++) {
                const index = sortedIndices[i];
                
                try {
                    // Обновляем прогресс
                    this.updateProgressStore(
                        'in_progress',
                        i,
                        sortedIndices.length,
                        `Обработка NFT ${index} (${i + 1}/${sortedIndices.length})`,
                        { calculationId, currentIndex: index }
                    );
                    
                    this.logger.info(`🔍 Получаю NFT с индексом ${index} (${i + 1}/${sortedIndices.length})...`);
                    
                    // Делаем запрос именно для этого индекса
                    const response = await this.utils.getNftItems(this.config.collectionAddress, 1, index);
                    
                    if (!response.success || !response.nft_items || response.nft_items.length === 0) {
                        this.logger.error(`❌ Не удалось получить NFT с индексом ${index}`);
                        totalErrors++;
                        continue;
                    }
                    
                    const nftItem = response.nft_items[0];
                    
                    // Извлекаем данные
                    const nftData = this.extractNftDataFromResponse(nftItem, response);
                    
                    // Проверяем, есть ли уже такой NFT
                    const existingIndex = allData[CONSTANTS.COLLECTION_KEYS.NFTS].findIndex(nft => 
                        nft[CONSTANTS.NFT_KEYS.INDEX] === index
                    );
                    
                    if (existingIndex === -1) {
                        allData[CONSTANTS.COLLECTION_KEYS.NFTS].push(nftData);
                        this.logger.info(`✅ Добавлен NFT ${index}: "${nftData[CONSTANTS.NFT_KEYS.NAME]}"`);
                        totalFilled++;
                    } else {
                        allData[CONSTANTS.COLLECTION_KEYS.NFTS][existingIndex] = nftData;
                        this.logger.info(`✏️ Обновлен NFT ${index}: "${nftData[CONSTANTS.NFT_KEYS.NAME]}"`);
                        totalFilled++;
                    }
                    
                    // Обновляем last_processed_index если этот индекс больше текущего
                    const currentLastProcessed = allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX];
                    if (index > currentLastProcessed) {
                        allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] = index;
                    }
                    
                    // Небольшая задержка между запросами
                    await this.utils.sleep(this.config.collectionSettings.delayBetweenMessages);
                    
                } catch (error) {
                    this.logger.error(`❌ Ошибка обработки NFT ${index}:`, error.message);
                    totalErrors++;
                }
            }
            
            // После всех добавлений сортируем массив по индексам
            allData[CONSTANTS.COLLECTION_KEYS.NFTS].sort((a, b) => a[CONSTANTS.NFT_KEYS.INDEX] - b[CONSTANTS.NFT_KEYS.INDEX]);
            
            // Сохраняем файл
            await this.writeDataFile(allData);
            
            // Обновляем информацию о коллекции
            const collectionInfo = await this.utils.getCollectionInfo(this.config.collectionAddress);
            if (collectionInfo.success) {
                allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] = collectionInfo.totalNfts;
                await this.writeDataFile(allData);
            }
            
            const result = {
                success: true,
                message: `Дополнение завершено. Добавлено/обновлено: ${totalFilled}, ошибок: ${totalErrors}`,
                calculationId,
                statistics: {
                    totalMissing: missingIndices.length,
                    filled: totalFilled,
                    errors: totalErrors,
                    newTotalNfts: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
                    lastProcessedIndex: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX]
                },
                timestamp: new Date().toISOString()
            };
            
            this.updateProgressStore(
                'completed',
                sortedIndices.length,
                sortedIndices.length,
                result.message,
                result
            );
            
            this.logger.info(`🎉 ${result.message} (ID: ${calculationId})`);
            this.logger.info(`📊 Статистика:`);
            this.logger.info(`   Всего отсутствующих: ${result.statistics.totalMissing}`);
            this.logger.info(`   Успешно обработано: ${result.statistics.filled}`);
            this.logger.info(`   Ошибок: ${result.statistics.errors}`);
            this.logger.info(`   NFT в файле после дополнения: ${result.statistics.newTotalNfts}`);
            this.logger.info(`   Последний обработанный индекс: ${result.statistics.lastProcessedIndex}`);
            
            return result;
            
        } catch (error) {
            this.logger.error('❌ Ошибка дополнения отсутствующих NFT:', error.message);
            
            const errorResult = {
                success: false,
                message: 'Ошибка дополнения отсутствующих NFT',
                calculationId: calculationId || 'unknown',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            this.updateProgressStore(
                'error',
                0,
                0,
                `Ошибка: ${error.message}`,
                errorResult
            );
            
            throw error;
        }
    }

}

module.exports = new TribeInfoCollectorService();
