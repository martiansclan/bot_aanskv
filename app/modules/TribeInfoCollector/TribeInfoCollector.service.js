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
            currentStage: CONSTANTS.COLLECTION_STATUS.NOT_STARTED,
            calculationId: null,
            lastProgressUpdate: null
        };
        
        // Хранилище прогресса для polling
        this.progressStore = new Map();
        
        // Кеш для данных, чтобы не читать файл каждый раз
        this.dataCache = null;
        this.cacheTimestamp = null;
        this.cacheTimeout = 5000; // 5 секунд
        
        this.logger = {
            info: (msg, ...args) => console.log(`[${CONSTANTS.LOG_TAGS.INFO}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args),
            error: (msg, ...args) => console.error(`[${CONSTANTS.LOG_TAGS.ERROR}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args),
            warn: (msg, ...args) => console.warn(`[${CONSTANTS.LOG_TAGS.WARN}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args)
        };
    }

    /**
     * Получает путь к файлу собранных данных
     */
    getCollectedDataPath() {
        return this.config.dataFiles.collectedData;
    }

    /**
     * Получает путь к сводному файлу
     */
    getSummaryDataPath() {
        return this.config.dataFiles.summaryData;
    }

    /**
     * Создает структуру данных
     */
    createDataStructure() {
        return {
            [CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]: {
                [CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY]: 0,
                [CONSTANTS.COLLECTION_KEYS.LAST_UPDATED]: null,
                [CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX]: 0
            },
            [CONSTANTS.COLLECTION_KEYS.NFTS]: []
        };
    }

    /**
     * Читает данные из файла с обработкой ошибок и кешированием
     */
    async readDataFile(forceRefresh = false) {
        // Проверяем кеш
        const now = Date.now();
        if (!forceRefresh && this.dataCache && this.cacheTimestamp && 
            (now - this.cacheTimestamp) < this.cacheTimeout) {
            return this.dataCache;
        }
        
        const filePath = this.getCollectedDataPath();
        
        try {
            await fs.access(filePath);
            const content = await fs.readFile(filePath, 'utf8');
            
            // Проверяем и чиним JSON если нужно
            let data;
            try {
                data = JSON.parse(content);
            } catch (parseError) {
                this.logger.warn(`❌ Ошибка парсинга JSON, пытаюсь восстановить: ${parseError.message}`);
                
                // Пытаемся восстановить JSON
                const repairedContent = this.repairJson(content);
                
                try {
                    data = JSON.parse(repairedContent);
                    this.logger.info('✅ JSON успешно восстановлен');
                    
                    // Сохраняем исправленную версию
                    await fs.writeFile(filePath, repairedContent, 'utf8');
                    this.logger.info('📁 Исправленный файл сохранен');
                } catch (repairError) {
                    this.logger.error(`❌ Не удалось восстановить JSON: ${repairError.message}`);
                    
                    // Создаем новую структуру если файл полностью битый
                    this.logger.info('🔄 Создание новой структуры данных');
                    data = this.createDataStructure();
                    
                    // Сохраняем новую структуру
                    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
                }
            }
            
            // Кешируем данные
            this.dataCache = data;
            this.cacheTimestamp = Date.now();
            
            return data;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Файл не существует, создаем новый
                this.logger.info('📁 Файл данных не найден, создаю новый...');
                const newData = this.createDataStructure();
                
                // Сохраняем новую структуру
                await fs.writeFile(filePath, JSON.stringify(newData, null, 2), 'utf8');
                this.logger.info(`✅ Создан файл данных: ${path.basename(filePath)}`);
                
                // Кешируем
                this.dataCache = newData;
                this.cacheTimestamp = Date.now();
                
                return newData;
            }
            
            this.logger.error('❌ Ошибка чтения файла данных:', error.message);
            throw new Error(CONSTANTS.ERROR_MESSAGES.FILE_READ_ERROR);
        }
    }

    /**
     * Пытается восстановить поврежденный JSON
     */
    repairJson(content) {
        let repaired = content;
        
        // Удаляем незавершенные строки в конце файла
        const lines = repaired.split('\n');
        let inString = false;
        let escapeNext = false;
        let repairedLines = [];
        
        for (let line of lines) {
            let lineResult = '';
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const prevChar = i > 0 ? line[i - 1] : '';
                
                if (escapeNext) {
                    escapeNext = false;
                    lineResult += char;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    lineResult += char;
                    continue;
                }
                
                if (char === '"' && !escapeNext) {
                    inString = !inString;
                }
                
                lineResult += char;
            }
            
            // Если в конце строки остаемся внутри строки, добавляем закрывающую кавычку
            if (inString) {
                lineResult += '"';
                inString = false;
            }
            
            repairedLines.push(lineResult);
        }
        
        repaired = repairedLines.join('\n');
        
        // Убедимся, что JSON правильно закрыт
        let openBrackets = 0;
        let openBraces = 0;
        
        for (let char of repaired) {
            if (char === '[') openBrackets++;
            if (char === ']') openBrackets--;
            if (char === '{') openBraces++;
            if (char === '}') openBraces--;
        }
        
        // Добавляем недостающие закрывающие скобки
        while (openBrackets > 0) {
            repaired += ']';
            openBrackets--;
        }
        
        while (openBraces > 0) {
            repaired += '}';
            openBraces--;
        }
        
        // Убедимся, что последний объект в массиве правильно закрыт
        const lastCommaIndex = repaired.lastIndexOf(',}');
        if (lastCommaIndex !== -1) {
            repaired = repaired.slice(0, lastCommaIndex) + '}' + repaired.slice(lastCommaIndex + 2);
        }
        
        // Удаляем лишние запятые перед закрывающими скобками
        repaired = repaired.replace(/,\s*([\]}])/g, '$1');
        
        return repaired;
    }

    /**
     * Записывает данные в файл и обновляет кеш
     */
    async writeDataFile(data) {
        const filePath = this.getCollectedDataPath();
        
        try {
            // Преобразуем данные в JSON с форматированием
            const jsonContent = JSON.stringify(data, null, 2);
            
            // Пишем во временный файл сначала
            const tempPath = filePath + '.tmp';
            await fs.writeFile(tempPath, jsonContent, 'utf8');
            
            // Проверяем что файл валидный
            await fs.readFile(tempPath, 'utf8').then(content => JSON.parse(content));
            
            // Заменяем старый файл новым
            await fs.rename(tempPath, filePath);
            
            // Обновляем timestamp
            data[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_UPDATED] = 
                new Date().toISOString();
            
            // Обновляем кеш
            this.dataCache = data;
            this.cacheTimestamp = Date.now();
            
            return { success: true, filePath };
            
        } catch (error) {
            this.logger.error('❌ Ошибка записи в файл данных:', error.message);
            
            // Пытаемся удалить временный файл если он существует
            try {
                await fs.unlink(filePath + '.tmp').catch(() => {});
            } catch (unlinkError) {
                // Игнорируем ошибку удаления
            }
            
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
     * ЭТАП 1: Получает базовую информацию о NFT
     */
    async stage1FetchBasicInfo(batchSize = this.config.collectionSettings.batchSize) {
        try {
            let allData = await this.readDataFile();
            
            // Получаем актуальное количество NFT
            const collectionInfo = await this.utils.getCollectionInfo(this.config.collectionAddress);
            if (!collectionInfo.success) {
                throw new Error(collectionInfo.error);
            }
            
            const totalNfts = collectionInfo.totalNfts;
            
            // Сохраняем текущий прогресс
            const currentLastProcessed = allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] || 0;
            
            // Обновляем информацию о коллекции
            allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] = totalNfts;
            allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_UPDATED] = new Date().toISOString();
            allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] = currentLastProcessed;
            
            await this.writeDataFile(allData);
            
            // Начинаем с того места, где остановились
            let offset = currentLastProcessed;
            
            // Если уже все NFT обработаны на этапе 1
            if (offset >= totalNfts) {
                this.logger.info('✅ Этап 1 уже завершен');
                return { success: true, totalNfts: totalNfts, processed: 0 };
            }
            
            const remaining = totalNfts - offset;
            this.logger.info(`🔄 Этап 1: Начинаю обработку ${remaining} NFT`);
            
            let batchNumber = Math.floor(offset / batchSize);
            let totalProcessed = 0;
            
            while (offset < totalNfts && this.collectionProcess.isRunning) {
                batchNumber++;
                
                const limit = Math.min(batchSize, totalNfts - offset);
                
                if (batchNumber % 10 === 0 || limit < batchSize) {
                    this.logger.info(`📦 Пачка ${batchNumber}: offset=${offset}, лимит=${limit}, обработано=${totalProcessed}/${remaining}`);
                    
                    // Обновляем прогресс
                    this.updateProgressStore(
                        CONSTANTS.COLLECTION_STATUS.STAGE_1,
                        totalProcessed,
                        remaining,
                        `Этап 1: Обработано ${totalProcessed}/${remaining} NFT`
                    );
                }
                
                // Получаем NFT предметы
                const response = await this.utils.getNftItems(this.config.collectionAddress, limit, offset);
                
                if (!response.success) {
                    throw new Error(response.error);
                }
                
                if (!response.nft_items || response.nft_items.length === 0) {
                    this.logger.warn('⚠️ Пустая пачка, возможно конец коллекции');
                    break;
                }
                
                for (const nftItem of response.nft_items) {
                    if (!this.collectionProcess.isRunning) break;
                    
                    const nftIndex = parseInt(nftItem.index || '0');
                    const nftAddress = nftItem.address;
                    const ownerAddress = nftItem.owner?.address || '';
                    
                    // Проверяем, есть ли уже такой NFT
                    const existingIndex = allData[CONSTANTS.COLLECTION_KEYS.NFTS].findIndex(nft => 
                        nft[CONSTANTS.NFT_KEYS.ADDRESS] === nftAddress || nft[CONSTANTS.NFT_KEYS.INDEX] === nftIndex
                    );
                    
                    if (existingIndex === -1) {
                        // Добавляем новую запись
                        allData[CONSTANTS.COLLECTION_KEYS.NFTS].push({
                            [CONSTANTS.NFT_KEYS.INDEX]: nftIndex,
                            [CONSTANTS.NFT_KEYS.ADDRESS]: nftAddress,
                            [CONSTANTS.NFT_KEYS.OWNER_ADDRESS]: ownerAddress,
                            [CONSTANTS.NFT_KEYS.STAGE1_COMPLETED]: true,
                            stage1_timestamp: new Date().toISOString(),
                            [CONSTANTS.NFT_KEYS.USER_FRIENDLY_ADDRESS]: '',
                            [CONSTANTS.NFT_KEYS.NAME]: '',
                            [CONSTANTS.NFT_KEYS.IMAGE_URL]: '',
                            [CONSTANTS.NFT_KEYS.ATTRIBUTES]: [],
                            [CONSTANTS.NFT_KEYS.GETGEMS_URL]: '',
                            [CONSTANTS.NFT_KEYS.OWNER_URL]: '',
                            [CONSTANTS.NFT_KEYS.STAGE2_COMPLETED]: false,
                            [CONSTANTS.NFT_KEYS.STAGE3_COMPLETED]: false
                        });
                    } else {
                        // Обновляем существующую запись
                        allData[CONSTANTS.COLLECTION_KEYS.NFTS][existingIndex][CONSTANTS.NFT_KEYS.OWNER_ADDRESS] = ownerAddress;
                        allData[CONSTANTS.COLLECTION_KEYS.NFTS][existingIndex][CONSTANTS.NFT_KEYS.STAGE1_COMPLETED] = true;
                        allData[CONSTANTS.COLLECTION_KEYS.NFTS][existingIndex].stage1_timestamp = new Date().toISOString();
                    }
                }
                
                offset += limit;
                totalProcessed += response.nft_items.length;
                
                // Обновляем последний обработанный индекс
                allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] = offset;
                
                // Сохраняем прогресс каждые 500 NFT
                if (totalProcessed % 500 === 0) {
                    await this.writeDataFile(allData);
                }
                
                // Задержка между пачками
                if (this.collectionProcess.isRunning && offset < totalNfts) {
                    await this.utils.sleep(this.config.collectionSettings.delayBetweenBatches);
                }
            }
            
            // Финальное сохранение
            allData[CONSTANTS.COLLECTION_KEYS.NFTS].sort((a, b) => a[CONSTANTS.NFT_KEYS.INDEX] - b[CONSTANTS.NFT_KEYS.INDEX]);
            await this.writeDataFile(allData);
            
            this.logger.info(`✅ Этап 1 завершен! Обработано: ${totalProcessed} NFT`);
            
            return { 
                success: true, 
                totalNfts: totalNfts,
                processed: totalProcessed 
            };
            
        } catch (error) {
            this.logger.error('❌ Ошибка на этапе 1:', error.message);
            throw error;
        }
    }

    /**
     * ЭТАП 2: Получает детальную информацию о NFT
     */
    async stage2FetchDetails() {
        try {
            let allData = await this.readDataFile();
            
            const totalNfts = allData[CONSTANTS.COLLECTION_KEYS.NFTS].length;
            if (totalNfts === 0) {
                throw new Error('Нет данных для обработки на этапе 2');
            }
            
            // Находим NFT, которые еще не обработаны на этапе 2
            const pendingNfts = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(nft => !nft[CONSTANTS.NFT_KEYS.STAGE2_COMPLETED]);
            const pendingCount = pendingNfts.length;
            
            if (pendingCount === 0) {
                this.logger.info('✅ Все NFT уже обработаны на этапе 2');
                return { success: true, processed: 0, errors: 0 };
            }
            
            this.logger.info(`🔄 Этап 2: Начинаю обработку ${pendingCount} NFT`);
            
            let processedCount = 0;
            let successCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < pendingNfts.length && this.collectionProcess.isRunning; i++) {
                const nft = pendingNfts[i];
                const nftIndex = allData[CONSTANTS.COLLECTION_KEYS.NFTS].findIndex(item => item[CONSTANTS.NFT_KEYS.ADDRESS] === nft[CONSTANTS.NFT_KEYS.ADDRESS]);
                
                processedCount++;
                
                // Логируем прогресс каждые 100 NFT
                if (processedCount % 100 === 0 || processedCount === pendingCount) {
                    this.logger.info(`📊 Прогресс этапа 2: ${processedCount}/${pendingCount} (${((processedCount/pendingCount)*100).toFixed(1)}%)`);
                    
                    // Обновляем прогресс
                    this.updateProgressStore(
                        CONSTANTS.COLLECTION_STATUS.STAGE_2,
                        processedCount,
                        pendingCount,
                        `Этап 2: Обработано ${processedCount}/${pendingCount} NFT`
                    );
                }
                
                try {
                    // 1. Получаем user-friendly адрес NFT
                    const addressData = await this.utils.getAddressBook(nft[CONSTANTS.NFT_KEYS.ADDRESS]);
                    
                    let userFriendly = nft[CONSTANTS.NFT_KEYS.ADDRESS];
                    if (addressData.success && addressData.user_friendly) {
                        userFriendly = addressData.user_friendly;
                    }
                    
                    // 2. Получаем метаданные NFT
                    const metadataData = await this.utils.getNFTMetadata(nft[CONSTANTS.NFT_KEYS.ADDRESS]);
                    
                    let name = 'Не указано';
                    let imageUrl = '';
                    let attributes = [];
                    
                    if (metadataData.success) {
                        if (metadataData.metadata && metadataData.metadata.length > 0) {
                            const tokenInfo = metadataData.metadata[0];
                            
                            name = tokenInfo.name || 'Не указано';
                            imageUrl = tokenInfo.image || tokenInfo.image_medium || tokenInfo.image_small || '';
                            attributes = tokenInfo.attributes || [];
                        }
                    }
                    
                    // Обновляем данные NFT
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.USER_FRIENDLY_ADDRESS] = userFriendly;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.NAME] = name;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.IMAGE_URL] = imageUrl;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.ATTRIBUTES] = attributes;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.STAGE2_COMPLETED] = true;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex].stage2_timestamp = new Date().toISOString();
                    
                    successCount++;
                    
                } catch (error) {
                    this.logger.error(`❌ Ошибка обработки NFT ${nft[CONSTANTS.NFT_KEYS.ADDRESS].substring(0, 20)}`);
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex].stage2_error = error.message;
                    errorCount++;
                }
                
                // Сохраняем прогресс каждые 50 NFT
                if (processedCount % 50 === 0) {
                    await this.writeDataFile(allData);
                }
                
                // Задержка между запросами
                if (this.collectionProcess.isRunning && i < pendingNfts.length - 1) {
                    await this.utils.sleep(this.config.collectionSettings.delayBetweenMessages);
                }
            }
            
            // Финальное сохранение
            await this.writeDataFile(allData);
            
            this.logger.info(`✅ Этап 2 завершен! Успешно: ${successCount}, Ошибок: ${errorCount}`);
            
            return { 
                success: true, 
                processed: successCount,
                errors: errorCount 
            };
            
        } catch (error) {
            this.logger.error('❌ Ошибка на этапе 2:', error.message);
            throw error;
        }
    }

    /**
     * ЭТАП 3: Формирование ссылок
     */
    async stage3GenerateLinks() {
        try {
            let allData = await this.readDataFile();
            
            const totalNfts = allData[CONSTANTS.COLLECTION_KEYS.NFTS].length;
            if (totalNfts === 0) {
                throw new Error('Нет данных для обработки на этапе 3');
            }
            
            // Находим NFT, которые еще не обработаны на этапе 3
            const pendingNfts = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(nft => 
                nft[CONSTANTS.NFT_KEYS.STAGE2_COMPLETED] && !nft[CONSTANTS.NFT_KEYS.STAGE3_COMPLETED]
            );
            const pendingCount = pendingNfts.length;
            
            if (pendingCount === 0) {
                this.logger.info('✅ Все NFT уже обработаны на этапе 3');
                return { success: true, processed: 0 };
            }
            
            this.logger.info(`🔄 Этап 3: Начинаю обработку ${pendingCount} NFT`);
            
            let processedCount = 0;
            let successCount = 0;
            
            for (let i = 0; i < pendingNfts.length && this.collectionProcess.isRunning; i++) {
                const nft = pendingNfts[i];
                const nftIndex = allData[CONSTANTS.COLLECTION_KEYS.NFTS].findIndex(item => item[CONSTANTS.NFT_KEYS.ADDRESS] === nft[CONSTANTS.NFT_KEYS.ADDRESS]);
                
                processedCount++;
                
                // Логируем прогресс каждые 200 NFT
                if (processedCount % 200 === 0 || processedCount === pendingCount) {
                    this.logger.info(`📊 Прогресс этапа 3: ${processedCount}/${pendingCount} (${((processedCount/pendingCount)*100).toFixed(1)}%)`);
                    
                    // Обновляем прогресс
                    this.updateProgressStore(
                        CONSTANTS.COLLECTION_STATUS.STAGE_3,
                        processedCount,
                        pendingCount,
                        `Этап 3: Обработано ${processedCount}/${pendingCount} NFT`
                    );
                }
                
                try {
                    // 1. Ссылка на страницу NFT на Getgems.io
                    const nftAddressForUrl = nft[CONSTANTS.NFT_KEYS.USER_FRIENDLY_ADDRESS] || nft[CONSTANTS.NFT_KEYS.ADDRESS];
                    const getgemsUrl = `https://getgems.io/collection/${this.config.collectionAddress}/${nftAddressForUrl}`;
                    
                    // 2. Ссылка на профиль владельца
                    let ownerUrl = '';
                    if (nft[CONSTANTS.NFT_KEYS.OWNER_ADDRESS] && nft[CONSTANTS.NFT_KEYS.OWNER_ADDRESS].trim() !== '') {
                        ownerUrl = `https://getgems.io/user/${nft[CONSTANTS.NFT_KEYS.OWNER_ADDRESS]}`;
                    }
                    
                    // 3. Обновляем данные NFT
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.GETGEMS_URL] = getgemsUrl;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.OWNER_URL] = ownerUrl;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex][CONSTANTS.NFT_KEYS.STAGE3_COMPLETED] = true;
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex].stage3_timestamp = new Date().toISOString();
                    
                    successCount++;
                    
                } catch (error) {
                    this.logger.error(`❌ Ошибка генерации ссылок для NFT ${nft[CONSTANTS.NFT_KEYS.INDEX]}`);
                    allData[CONSTANTS.COLLECTION_KEYS.NFTS][nftIndex].stage3_error = error.message;
                }
                
                // Сохраняем прогресс каждые 100 NFT
                if (processedCount % 100 === 0) {
                    await this.writeDataFile(allData);
                }
            }
            
            // Финальное сохранение
            await this.writeDataFile(allData);
            
            this.logger.info(`✅ Этап 3 завершен! Обработано: ${successCount} NFT`);
            
            return { 
                success: true, 
                processed: successCount 
            };
            
        } catch (error) {
            this.logger.error('❌ Ошибка на этапе 3:', error.message);
            throw error;
        }
    }

    /**
     * Полный сбор данных (все три этапа)
     */
    async collectAllNfts(options = {}) {
        const {
            startFromStage = CONSTANTS.COLLECTION_STATUS.STAGE_1,
            calculationId = `collect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        } = options;

        if (this.collectionProcess.isRunning) {
            throw new Error(CONSTANTS.ERROR_MESSAGES.PROCESS_ALREADY_RUNNING);
        }

        try {
            // Устанавливаем флаги процесса
            this.collectionProcess.isRunning = true;
            this.collectionProcess.currentStage = startFromStage;
            this.collectionProcess.calculationId = calculationId;
            
            this.logger.info(`🚀 Запуск сбора данных (ID: ${calculationId})`);

            // Сохраняем начальный прогресс
            this.updateProgressStore(
                startFromStage,
                0,
                0,
                'Начинаю сбор данных...',
                { calculationId, startedAt: new Date().toISOString() }
            );

            let stage1Result, stage2Result, stage3Result;
            
            // ========== ЭТАП 1: Базовая информация ==========
            if (startFromStage <= CONSTANTS.COLLECTION_STATUS.STAGE_1 && this.collectionProcess.isRunning) {
                this.collectionProcess.currentStage = CONSTANTS.COLLECTION_STATUS.STAGE_1;
                
                this.updateProgressStore(
                    CONSTANTS.COLLECTION_STATUS.STAGE_1,
                    0,
                    0,
                    'Начинаю этап 1: Получение базовой информации о NFT'
                );
                
                try {
                    stage1Result = await this.stage1FetchBasicInfo();
                    
                    if (!stage1Result.success) {
                        throw new Error(`Этап 1 завершился с ошибкой: ${stage1Result.error}`);
                    }
                    
                    this.updateProgressStore(
                        CONSTANTS.COLLECTION_STATUS.STAGE_1,
                        stage1Result.processed || 0,
                        stage1Result.totalNfts || 0,
                        `Этап 1 завершен. Обработано: ${stage1Result.processed || 0} NFT`
                    );
                    
                } catch (error) {
                    this.logger.error('❌ Ошибка на этапе 1:', error);
                    throw error;
                }
            }
            
            // Проверяем, не остановлен ли процесс
            if (!this.collectionProcess.isRunning) {
                this.logger.warn('⚠️ Процесс остановлен после этапа 1');
                return {
                    success: false,
                    message: 'Процесс остановлен',
                    stage: 'STAGE_1',
                    calculationId
                };
            }
            
            // ========== ЭТАП 2: Детальная информация ==========
            if (this.collectionProcess.isRunning) {
                this.collectionProcess.currentStage = CONSTANTS.COLLECTION_STATUS.STAGE_2;
                
                this.updateProgressStore(
                    CONSTANTS.COLLECTION_STATUS.STAGE_2,
                    0,
                    0,
                    'Начинаю этап 2: Получение детальной информации и метаданных'
                );
                
                try {
                    stage2Result = await this.stage2FetchDetails();
                    
                    if (!stage2Result.success) {
                        throw new Error(`Этап 2 завершился с ошибкой: ${stage2Result.error}`);
                    }
                    
                    this.updateProgressStore(
                        CONSTANTS.COLLECTION_STATUS.STAGE_2,
                        stage2Result.processed || 0,
                        stage2Result.total || (stage1Result?.totalNfts || 0),
                        `Этап 2 завершен. Успешно: ${stage2Result.processed || 0}, Ошибок: ${stage2Result.errors || 0}`
                    );
                    
                } catch (error) {
                    this.logger.error('❌ Ошибка на этапе 2:', error);
                    throw error;
                }
            }
            
            // Проверяем, не остановлен ли процесс
            if (!this.collectionProcess.isRunning) {
                this.logger.warn('⚠️ Процесс остановлен после этапа 2');
                return {
                    success: false,
                    message: 'Процесс остановлен',
                    stage: 'STAGE_2',
                    calculationId
                };
            }
            
            // ========== ЭТАП 3: Генерация ссылок ==========
            if (this.collectionProcess.isRunning) {
                this.collectionProcess.currentStage = CONSTANTS.COLLECTION_STATUS.STAGE_3;
                
                this.updateProgressStore(
                    CONSTANTS.COLLECTION_STATUS.STAGE_3,
                    0,
                    0,
                    'Начинаю этап 3: Генерация ссылок на Getgems.io'
                );
                
                try {
                    stage3Result = await this.stage3GenerateLinks();
                    
                    if (!stage3Result.success) {
                        throw new Error(`Этап 3 завершился с ошибкой: ${stage3Result.error}`);
                    }
                    
                    this.updateProgressStore(
                        CONSTANTS.COLLECTION_STATUS.STAGE_3,
                        stage3Result.processed || 0,
                        stage3Result.total || (stage1Result?.totalNfts || 0),
                        `Этап 3 завершен. Обработано: ${stage3Result.processed || 0} NFT`
                    );
                    
                } catch (error) {
                    this.logger.error('❌ Ошибка на этапе 3:', error);
                    throw error;
                }
            }
            
            // Проверяем, не остановлен ли процесс
            if (!this.collectionProcess.isRunning) {
                this.logger.warn('⚠️ Процесс остановлен после этапа 3');
                return {
                    success: false,
                    message: 'Процесс остановлен',
                    stage: 'STAGE_3',
                    calculationId
                };
            }
            
            // ========== Итоговая статистика и создание сводного файла ==========
            if (this.collectionProcess.isRunning) {
                this.collectionProcess.currentStage = CONSTANTS.COLLECTION_STATUS.COMPLETED;
                
                this.updateProgressStore(
                    CONSTANTS.COLLECTION_STATUS.COMPLETED,
                    95,
                    100,
                    'Создание сводного файла данных...'
                );
                
                try {
                    // Читаем итоговые данные
                    const allData = await this.readDataFile();
                    
                    // Подсчитываем NFT с полной обработкой
                    const completedNfts = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(nft => 
                        nft[CONSTANTS.NFT_KEYS.STAGE1_COMPLETED] && 
                        nft[CONSTANTS.NFT_KEYS.STAGE2_COMPLETED] && 
                        nft[CONSTANTS.NFT_KEYS.STAGE3_COMPLETED]
                    ).length;
                    
                    // Создаем сводный файл
                    const summaryResult = await this.createSummaryFile();
                    
                    // Формируем итоговый результат
                    const finalResult = {
                        success: true,
                        message: 'Сбор данных успешно завершен',
                        calculationId,
                        timestamp: new Date().toISOString(),
                        statistics: {
                            totalNftsInCollection: stage1Result?.totalNfts || 0,
                            totalNftsInFile: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
                            fullyCompletedNfts: completedNfts,
                            stage1: {
                                processed: stage1Result?.processed || 0,
                                status: 'completed'
                            },
                            stage2: {
                                processed: stage2Result?.processed || 0,
                                errors: stage2Result?.errors || 0,
                                status: 'completed'
                            },
                            stage3: {
                                processed: stage3Result?.processed || 0,
                                status: 'completed'
                            }
                        },
                        files: {
                            collectedData: this.getCollectedDataPath(),
                            summaryData: this.getSummaryDataPath(),
                            summaryCreated: summaryResult.success,
                            summaryFileSize: summaryResult.fileSize
                        }
                    };
                    
                    // Сохраняем финальный прогресс
                    this.updateProgressStore(
                        CONSTANTS.COLLECTION_STATUS.COMPLETED,
                        100,
                        100,
                        'Сбор данных завершен!',
                        finalResult
                    );
                    
                    this.logger.info(`🎉 Сбор данных завершен! (ID: ${calculationId})`);
                    this.logger.info(`📊 Статистика:`);
                    this.logger.info(`   Всего NFT в коллекции: ${finalResult.statistics.totalNftsInCollection}`);
                    this.logger.info(`   NFT в файле: ${finalResult.statistics.totalNftsInFile}`);
                    this.logger.info(`   Полностью обработано: ${finalResult.statistics.fullyCompletedNfts}`);
                    this.logger.info(`   Этап 1: ${finalResult.statistics.stage1.processed}`);
                    this.logger.info(`   Этап 2: ${finalResult.statistics.stage2.processed} (ошибок: ${finalResult.statistics.stage2.errors})`);
                    this.logger.info(`   Этап 3: ${finalResult.statistics.stage3.processed}`);
                    
                    return finalResult;
                    
                } catch (error) {
                    this.logger.error('❌ Ошибка при финализации данных:', error);
                    throw error;
                }
            }
            
        } catch (error) {
            this.logger.error('❌ Ошибка в процессе сбора данных:', error);
            
            // Формируем объект ошибки
            const errorResult = {
                success: false,
                message: 'Ошибка сбора данных',
                calculationId: this.collectionProcess.calculationId,
                error: error.message,
                stage: this.collectionProcess.currentStage,
                timestamp: new Date().toISOString()
            };
            
            // Сохраняем прогресс ошибки
            this.updateProgressStore(
                this.collectionProcess.currentStage,
                0,
                0,
                `Ошибка: ${error.message}`,
                errorResult
            );
            
            throw error;
            
        } finally {
            // Очищаем состояние процесса
            const wasRunning = this.collectionProcess.isRunning;
            const lastStage = this.collectionProcess.currentStage;
            const lastCalculationId = this.collectionProcess.calculationId;
            
            this.collectionProcess.isRunning = false;
            this.collectionProcess.currentStage = CONSTANTS.COLLECTION_STATUS.NOT_STARTED;
            this.collectionProcess.calculationId = null;
            
            // Логируем завершение процесса
            if (wasRunning) {
                this.logger.info(`🛑 Процесс сбора остановлен (был на этапе ${lastStage}, ID: ${lastCalculationId})`);
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

        // Сохраняем данные о процессе перед остановкой
        const currentCalculationId = this.collectionProcess.calculationId;
        const currentStage = this.collectionProcess.currentStage;
        const stageName = this.getStageName(currentStage);
        
        // Устанавливаем флаг остановки
        this.collectionProcess.isRunning = false;
        
        // Получаем текущий прогресс перед остановкой
        let currentData;
        try {
            currentData = await this.readDataFile();
            
            const stage1Count = currentData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE1_COMPLETED]).length;
            const stage2Count = currentData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE2_COMPLETED]).length;
            const stage3Count = currentData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE3_COMPLETED]).length;
            
            const totalNfts = currentData[CONSTANTS.COLLECTION_KEYS.NFTS].length;
            const processedPercent = totalNfts > 0 ? Math.round((stage1Count / totalNfts) * 100) : 0;
            
            this.logger.info(`🛑 Остановка сбора данных на этапе ${stageName}`);
            this.logger.info(`📊 Прогресс: Этап 1: ${stage1Count}/${totalNfts}, Этап 2: ${stage2Count}/${totalNfts}, Этап 3: ${stage3Count}/${totalNfts}`);
            
            // Обновляем прогресс
            this.updateProgressStore(
                currentStage,
                stage1Count,
                totalNfts,
                `Сбор данных остановлен на этапе: ${stageName}`,
                {
                    stage: currentStage,
                    stageName: stageName,
                    stoppedByUser: true,
                    timestamp: new Date().toISOString(),
                    progress: {
                        stage1: { completed: stage1Count, total: totalNfts },
                        stage2: { completed: stage2Count, total: totalNfts },
                        stage3: { completed: stage3Count, total: totalNfts },
                        overall: processedPercent
                    },
                    calculationId: currentCalculationId,
                    action: 'stop',
                    canContinue: true // Можно продолжить
                }
            );
            
        } catch (error) {
            this.logger.error('❌ Ошибка при получении данных для остановки:', error.message);
            
            // Все равно сохраняем прогресс
            this.updateProgressStore(
                currentStage,
                0,
                0,
                `Сбор данных остановлен (ошибка при получении прогресса)`,
                {
                    stage: currentStage,
                    stageName: stageName,
                    stoppedByUser: true,
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            );
        }
        
        // Сохраняем состояние остановки в файл
        try {
            const fileData = await this.readDataFile();
            
            // Добавляем информацию об остановке
            fileData.collection_process = {
                last_stop: {
                    timestamp: new Date().toISOString(),
                    stage: currentStage,
                    stage_name: stageName,
                    calculation_id: currentCalculationId,
                    stopped_by_user: true
                },
                last_calculation_id: currentCalculationId,
                is_running: false
            };
            
            await this.writeDataFile(fileData);
            this.logger.info('📁 Состояние остановки сохранено в файл данных');
            
        } catch (fileError) {
            this.logger.warn('⚠️ Не удалось сохранить состояние остановки в файл:', fileError.message);
        }
        
        // Очищаем процесс
        this.collectionProcess.isRunning = false;
        this.collectionProcess.currentStage = CONSTANTS.COLLECTION_STATUS.NOT_STARTED;
        // Не очищаем calculationId, чтобы можно было отслеживать остановленный процесс
        
        return {
            success: true,
            message: CONSTANTS.SUCCESS_MESSAGES.PROCESS_STOPPED,
            currentStage: currentStage,
            stageName: stageName,
            calculationId: currentCalculationId,
            timestamp: new Date().toISOString(),
            canContinue: true,
            details: {
                stoppedByUser: true,
                stoppedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Вспомогательная функция для получения названия этапа
     */
    getStageName(stage) {
        const stageNames = {
            [CONSTANTS.COLLECTION_STATUS.NOT_STARTED]: 'Не начат',
            [CONSTANTS.COLLECTION_STATUS.STAGE_1]: 'Этап 1: Получение базовой информации',
            [CONSTANTS.COLLECTION_STATUS.STAGE_2]: 'Этап 2: Получение детальной информации',
            [CONSTANTS.COLLECTION_STATUS.STAGE_3]: 'Этап 3: Генерация ссылок',
            [CONSTANTS.COLLECTION_STATUS.COMPLETED]: 'Завершено'
        };
        
        return stageNames[stage] || `Неизвестный этап (${stage})`;
    }

    /**
     * Показывает статус сбора данных (с обработкой ошибок файла)
     */
    async getCollectionStatus() {
        try {
            const allData = await this.readDataFile();
            
            const stage1Count = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE1_COMPLETED]).length;
            const stage2Count = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE2_COMPLETED]).length;
            const stage3Count = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE3_COMPLETED]).length;
            
            return {
                isRunning: this.collectionProcess.isRunning,
                currentStage: this.collectionProcess.currentStage,
                calculationId: this.collectionProcess.calculationId,
                collectionInfo: {
                    totalInCollection: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] || 0,
                    nftsInFile: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
                    lastUpdated: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_UPDATED],
                    lastProcessedIndex: allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX]
                },
                progress: {
                    stage1: {
                        completed: stage1Count,
                        total: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length
                    },
                    stage2: {
                        completed: stage2Count,
                        total: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length
                    },
                    stage3: {
                        completed: stage3Count,
                        total: allData[CONSTANTS.COLLECTION_KEYS.NFTS].length
                    }
                }
            };
            
        } catch (error) {
            this.logger.error('❌ Ошибка получения статуса:', error.message);
            
            // Возвращаем базовый статус при ошибке
            return {
                isRunning: this.collectionProcess.isRunning,
                currentStage: this.collectionProcess.currentStage,
                calculationId: this.collectionProcess.calculationId,
                collectionInfo: {
                    totalInCollection: 0,
                    nftsInFile: 0,
                    lastUpdated: null,
                    lastProcessedIndex: 0
                },
                progress: {
                    stage1: { completed: 0, total: 0 },
                    stage2: { completed: 0, total: 0 },
                    stage3: { completed: 0, total: 0 }
                },
                error: error.message
            };
        }
    }

    /**
     * Продолжение сбора с текущего этапа
     */
    async continueCollection() {
        try {
            const allData = await this.readDataFile();
            
            // Получаем актуальное количество NFT в коллекции
            const collectionInfo = await this.utils.getCollectionInfo(this.config.collectionAddress);
            if (!collectionInfo.success) {
                throw new Error(collectionInfo.error);
            }
            
            const totalNfts = collectionInfo.totalNfts;
            const nftsInFile = allData[CONSTANTS.COLLECTION_KEYS.NFTS].length;
            const lastProcessedIndex = allData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] || 0;
            
            // Определяем с какого этапа продолжать
            let startFromStage = CONSTANTS.COLLECTION_STATUS.STAGE_1;
            
            if (nftsInFile === 0) {
                startFromStage = CONSTANTS.COLLECTION_STATUS.STAGE_1;
            } else if (lastProcessedIndex < totalNfts) {
                startFromStage = CONSTANTS.COLLECTION_STATUS.STAGE_1;
            } else {
                const stage2Count = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE2_COMPLETED]).length;
                const stage3Count = allData[CONSTANTS.COLLECTION_KEYS.NFTS].filter(n => n[CONSTANTS.NFT_KEYS.STAGE3_COMPLETED]).length;
                
                if (stage2Count < nftsInFile) {
                    startFromStage = CONSTANTS.COLLECTION_STATUS.STAGE_2;
                } else if (stage3Count < nftsInFile) {
                    startFromStage = CONSTANTS.COLLECTION_STATUS.STAGE_3;
                } else {
                    throw new Error('Все этапы сбора данных уже завершены!');
                }
            }
                    
            // Запускаем сбор с нужного этапа
            return await this.collectAllNfts({ 
                startFromStage: startFromStage
            });
            
        } catch (error) {
            this.logger.error('❌ Ошибка продолжения сбора:', error);
            throw error;
        }
    }

    /**
     * Создает сводный файл данных с обработкой ошибок
     */
    async createSummaryFile() {
        try {
            this.logger.info('📝 Создание сводного файла...');
            
            // 1. Читаем полные данные
            const fullData = await this.readDataFile();
            
            // 2. Формируем сводную структуру
            const summaryData = {
                [CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]: {
                    [CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY]: 
                        fullData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] || 0,
                    [CONSTANTS.COLLECTION_KEYS.LAST_UPDATED]: new Date().toISOString(),
                    [CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX]: 
                        fullData[CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO][CONSTANTS.COLLECTION_KEYS.LAST_PROCESSED_INDEX] || 0
                },
                [CONSTANTS.COLLECTION_KEYS.NFTS]: []
            };

            // 3. Копируем только нужные поля для каждого NFT
            for (const nft of fullData[CONSTANTS.COLLECTION_KEYS.NFTS]) {
                const summaryNft = {
                    [CONSTANTS.NFT_KEYS.INDEX]: nft[CONSTANTS.NFT_KEYS.INDEX],
                    [CONSTANTS.NFT_KEYS.ADDRESS]: nft[CONSTANTS.NFT_KEYS.ADDRESS],
                    [CONSTANTS.NFT_KEYS.OWNER_ADDRESS]: nft[CONSTANTS.NFT_KEYS.OWNER_ADDRESS] || '',
                    [CONSTANTS.NFT_KEYS.USER_FRIENDLY_ADDRESS]: nft[CONSTANTS.NFT_KEYS.USER_FRIENDLY_ADDRESS] || '',
                    [CONSTANTS.NFT_KEYS.NAME]: nft[CONSTANTS.NFT_KEYS.NAME] || '',
                    [CONSTANTS.NFT_KEYS.IMAGE_URL]: nft[CONSTANTS.NFT_KEYS.IMAGE_URL] || '',
                    [CONSTANTS.NFT_KEYS.ATTRIBUTES]: Array.isArray(nft[CONSTANTS.NFT_KEYS.ATTRIBUTES]) ? 
                        [...nft[CONSTANTS.NFT_KEYS.ATTRIBUTES]] : [],
                    [CONSTANTS.NFT_KEYS.GETGEMS_URL]: nft[CONSTANTS.NFT_KEYS.GETGEMS_URL] || '',
                    [CONSTANTS.NFT_KEYS.OWNER_URL]: nft[CONSTANTS.NFT_KEYS.OWNER_URL] || ''
                };

                summaryData[CONSTANTS.COLLECTION_KEYS.NFTS].push(summaryNft);
            }

            // 4. Сортируем по индексу
            summaryData[CONSTANTS.COLLECTION_KEYS.NFTS].sort((a, b) => 
                a[CONSTANTS.NFT_KEYS.INDEX] - b[CONSTANTS.NFT_KEYS.INDEX]
            );
            
            // 5. Записываем во временный файл
            const filePath = this.getSummaryDataPath();
            const tempPath = filePath + '.tmp';
            const jsonContent = JSON.stringify(summaryData, null, 2);
            
            await fs.writeFile(tempPath, jsonContent, 'utf8');
            
            // Проверяем что файл валидный
            await fs.readFile(tempPath, 'utf8').then(content => JSON.parse(content));
            
            // Заменяем старый файл новым
            await fs.rename(tempPath, filePath);
            
            // Проверяем что файл создан
            const fileSize = (await fs.stat(filePath)).size;
            
            this.logger.info(`✅ Создан сводный файл: ${path.basename(filePath)}`);
            this.logger.info(`📊 Количество NFT: ${summaryData[CONSTANTS.COLLECTION_KEYS.NFTS].length}`);
            this.logger.info(`💾 Размер: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
            
            return {
                success: true,
                fileName: path.basename(filePath),
                filePath: filePath,
                nftCount: summaryData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
                fileSize: fileSize
            };
            
        } catch (error) {
            this.logger.error('❌ Ошибка создания сводного файла:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Обновляет хранилище прогресса для polling
     */
    updateProgressStore(stage, processed, total, message, details = {}) {
        try {
            const calculationId = this.collectionProcess.calculationId;
            
            if (!calculationId) {
                return;
            }
            
            const progressData = {
                calculationId,
                stage,
                processed,
                total,
                message,
                details,
                timestamp: new Date().toISOString(),
                status: stage === CONSTANTS.COLLECTION_STATUS.COMPLETED ? 'completed' : 
                       stage === CONSTANTS.COLLECTION_STATUS.NOT_STARTED ? 'not_started' : 'in_progress'
            };
            
            // Сохраняем в хранилище
            this.progressStore.set(calculationId, progressData);
            
            // Обновляем время последнего обновления
            this.collectionProcess.lastProgressUpdate = Date.now();
            
            // Логируем важные события
            if (stage === CONSTANTS.COLLECTION_STATUS.COMPLETED || 
                stage === CONSTANTS.COLLECTION_STATUS.NOT_STARTED ||
                message.includes('Ошибка') ||
                message.includes('завершен') ||
                processed === total) {
                this.logger.info(`📊 ${message} (${processed}/${total})`);
            }
            
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
        
        // Проверяем, не устарели ли данные (больше 5 минут)
        const now = Date.now();
        const updateTime = new Date(progress.timestamp).getTime();
        
        if (now - updateTime > 5 * 60 * 1000) {
            return {
                ...progress,
                status: 'stale',
                message: 'Данные прогресса устарели'
            };
        }
        
        return progress;
    }

    /**
     * Проверяет существование файлов
     */
    async checkFiles() {
        const files = [
            { name: 'all_nft_info_collected.json', path: this.getCollectedDataPath() },
            { name: 'all_nft_info.json', path: this.getSummaryDataPath() }
        ];
        
        const results = [];
        
        for (const file of files) {
            try {
                await fs.access(file.path);
                const stats = await fs.stat(file.path);
                const content = await fs.readFile(file.path, 'utf8');
                
                // Пытаемся парсить JSON
                let data;
                let isValidJson = true;
                try {
                    data = JSON.parse(content);
                } catch (error) {
                    isValidJson = false;
                    data = {};
                }
                
                results.push({
                    name: file.name,
                    exists: true,
                    size: stats.size,
                    sizeMB: (stats.size / 1024 / 1024).toFixed(2),
                    nftCount: data[CONSTANTS.COLLECTION_KEYS.NFTS]?.length || 0,
                    lastModified: stats.mtime,
                    isValidJson: isValidJson
                });
            } catch (error) {
                results.push({
                    name: file.name,
                    exists: false,
                    error: error.message
                });
            }
        }
        
        // Проверяем директорию
        const dataDir = path.join(__dirname, '../../../nft_data');
        let dirExists = false;
        try {
            await fs.access(dataDir);
            dirExists = true;
        } catch (error) {
            // Директории нет
        }
        
        return {
            dataDirectory: {
                path: dataDir,
                exists: dirExists
            },
            files: results
        };
    }
}

module.exports = new TribeInfoCollectorService();