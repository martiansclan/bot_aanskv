// app/modules/power/power.service.js
const path = require('path');
const fs = require('fs').promises;
const powerUtils = require('./power.utils');
const CONSTANTS = require('./power.constants');

class PowerService {
    constructor() {
        this.config = require('./power.config');
        this.constants = CONSTANTS;
        this.cache = new Map();
        
        this.logger = {
            info: (msg, ...args) => console.log(`[${CONSTANTS.LOG_TAGS.INFO}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args),
            error: (msg, ...args) => console.error(`[${CONSTANTS.LOG_TAGS.ERROR}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args),
            warn: (msg, ...args) => console.warn(`[${CONSTANTS.LOG_TAGS.WARN}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args),
            chunk: (msg, ...args) => console.log(`[${CONSTANTS.LOG_TAGS.CHUNK}][${CONSTANTS.LOG_TAGS.MODULE_PREFIX}] ${msg}`, ...args)
        };
    }

    // Загрузка данных атрибутов Power
    async loadAttributesPowerData() {
        try {
            const filePath = this.config.dataFiles.attributesPower;
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            this.logger.error(`Ошибка загрузки данных атрибутов Power: ${error.message}`);
            throw error;
        }
    }

    // Загрузка оригинальных NFT
    async loadOriginalNFTs() {
        try {
            const filePath = this.config.dataFiles.originalNfts;
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            this.logger.error(`Ошибка загрузки оригинальных NFT: ${error.message}`);
            throw error;
        }
    }

    // Загрузка NFT с Power
    async loadPowerNFTs() {
        try {
            const filePath = this.config.dataFiles.powerNfts;
            await fs.access(filePath);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return await this.loadOriginalNFTs();
        }
    }

    // Сохранение NFT с Power
    async savePowerNFTs(data) {
        try {
            const filePath = this.config.dataFiles.powerNfts;
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
            this.logger.info(`Данные сохранены в ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            this.logger.error('Ошибка сохранения NFT с Power:', error);
            throw error;
        }
    }

    // Загрузка данных о синергиях
    async loadSynergyData() {
        try {
            const filePath = this.config.dataFiles.synergyData;
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            this.logger.warn('Данные о синергиях не найдены, возвращаем пустой объект');
            return {};
        }
    }
    
    // ОПТИМИЗИРОВАННЫЙ расчет Power на сервере
    async calculatePowerForAll() {
        const startTime = Date.now();
        
        try {
            this.logger.info('🚀 Начинаем серверный расчет Power...');

            // Загружаем все необходимые данные
            const powerData = await this.loadAttributesPowerData();
            const synergyData = await this.loadSynergyData();
            const originalData = await this.loadOriginalNFTs();
            
            if (!originalData.nfts || !Array.isArray(originalData.nfts)) {
                throw new Error(CONSTANTS.ERROR_MESSAGES.INVALID_NFT_DATA);
            }

            const totalNFTs = originalData.nfts.length;
            let processedCount = 0;
           // let updatedCount = 0;
            let nftsWithSynergyCount = 0;
            
            this.logger.info(`📊 Всего NFT для обработки: ${totalNFTs}`);

            // Создаем структуру для результата
            const result = {
                [CONSTANTS.COLLECTION_KEYS.NFTS]: [],
                [CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]: {
                    ...originalData.collection_info,
                    [CONSTANTS.COLLECTION_KEYS.POWER_CALCULATED]: new Date().toISOString(),
                    [CONSTANTS.COLLECTION_KEYS.SYNERGY_CALCULATED]: new Date().toISOString(),
                    [CONSTANTS.COLLECTION_KEYS.ORIGINAL_FILE]: 'all_nft_info.json',
                    [CONSTANTS.COLLECTION_KEYS.POWER_VERSION]: CONSTANTS.MODULE.VERSION,
                    [CONSTANTS.COLLECTION_KEYS.SYNERGY_TYPES_COUNT]: Object.keys(synergyData).length,
                    processing_mode: 'server_optimized'
                }
            };

            // Обрабатываем NFT чанками
            const chunkSize = CONSTANTS.OPTIMIZATION.CHUNK_SIZE;
            
            for (let i = 0; i < originalData.nfts.length; i += chunkSize) {
                const chunk = originalData.nfts.slice(i, i + chunkSize);
                
                // Обрабатываем каждый NFT в чанке
                for (const originalNft of chunk) {
                    processedCount++;
                    
                    // Создаем копию NFT
                    const nft = JSON.parse(JSON.stringify(originalNft));
                    
                    // РАСЧЕТ НА СЕРВЕРЕ
                    const calculationResult = powerUtils.calculateNFTpower(nft, powerData, synergyData);
                    
                 /*   if (calculationResult.updated) {
                        updatedCount++;
                    }*/
                    
                    if (calculationResult.synergyPower > 0) {
                        nftsWithSynergyCount++;
                    }
                    
                    result[CONSTANTS.COLLECTION_KEYS.NFTS].push(nft);
                }

                // Логируем прогресс
                if (processedCount % CONSTANTS.OPTIMIZATION.PROGRESS_UPDATE_EVERY === 0) {
                    const progress = Math.round((processedCount / totalNFTs) * 100);
                    this.logger.info(`📈 Прогресс: ${progress}% (${processedCount}/${totalNFTs})`);
                }
            }

            // Обновляем метаданные
            result.collection_info[CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] = result[CONSTANTS.COLLECTION_KEYS.NFTS].length;
          //  result.collection_info[CONSTANTS.COLLECTION_KEYS.NFTS_WITH_POWER] = updatedCount;
            result.collection_info[CONSTANTS.COLLECTION_KEYS.NFTS_WITH_SYNERGY] = nftsWithSynergyCount;

            // Сохраняем результаты
            await this.savePowerNFTs(result);

            const processingTime = Date.now() - startTime;
            
            this.logger.info(`${CONSTANTS.SUCCESS_MESSAGES.POWER_CALCULATED}!`);
            this.logger.info(`   Всего обработано: ${processedCount} NFT`);
          //  this.logger.info(`   NFT с атрибутами Power: ${updatedCount}`);
            this.logger.info(`   NFT с синергиями: ${nftsWithSynergyCount}`);
            this.logger.info(`   Время: ${(processingTime / 1000).toFixed(2)} секунд`);

            return {
                totalProcessed: processedCount,
           //     totalUpdated: updatedCount,
                nftsWithSynergy: nftsWithSynergyCount,
                processingTimeMs: processingTime,
                fileSaved: 'all_nft_info_power.json'
            };
            
        } catch (error) {
            this.logger.error('Ошибка серверного расчета Power:', error);
            throw error;
        }
    }

    // Сохранение NFT (для клиентских расчетов - обратная совместимость)
    async saveUpdatedNFTs(nfts) {
        if (!nfts || !Array.isArray(nfts)) {
            throw new Error(CONSTANTS.ERROR_MESSAGES.INVALID_NFT_ARRAY);
        }

        let currentData;
        
        try {
            currentData = await this.loadPowerNFTs();
        } catch (error) {
            currentData = await this.createNewPowerData();
        }

        // Создаем карту для быстрого поиска
        const nftMap = new Map();
        if (currentData[CONSTANTS.COLLECTION_KEYS.NFTS]) {
            currentData[CONSTANTS.COLLECTION_KEYS.NFTS].forEach((nft, index) => {
                if (nft && nft[CONSTANTS.NFT_KEYS.INDEX] !== undefined) {
                    nftMap.set(nft[CONSTANTS.NFT_KEYS.INDEX], index);
                }
            });
        }

        let updatedCount = 0;
        let addedCount = 0;

        // Обрабатываем каждый NFT
        for (const newNft of nfts) {
            if (!newNft || newNft[CONSTANTS.NFT_KEYS.INDEX] === undefined) {
                this.logger.warn('⚠️ Пропущен NFT без индекса');
                continue;
            }

            const existingIndex = nftMap.get(newNft[CONSTANTS.NFT_KEYS.INDEX]);
            
            if (existingIndex !== undefined) {
                // Заменяем существующий NFT
                currentData[CONSTANTS.COLLECTION_KEYS.NFTS][existingIndex] = newNft;
                updatedCount++;
            } else {
                // Добавляем новый NFT
                currentData[CONSTANTS.COLLECTION_KEYS.NFTS].push(newNft);
                nftMap.set(newNft[CONSTANTS.NFT_KEYS.INDEX], currentData[CONSTANTS.COLLECTION_KEYS.NFTS].length - 1);
                addedCount++;
            }
        }

        // Обновляем метаданные
        currentData.collection_info[CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY] = currentData[CONSTANTS.COLLECTION_KEYS.NFTS].length;
        currentData.collection_info[CONSTANTS.COLLECTION_KEYS.LAST_UPDATED] = new Date().toISOString();

        this.logger.info(`💾 Сохранение: ${updatedCount} обновлено, ${addedCount} добавлено, всего: ${currentData[CONSTANTS.COLLECTION_KEYS.NFTS].length}`);

        // Сохраняем данные
        await this.savePowerNFTs(currentData);

        return {
            total: currentData[CONSTANTS.COLLECTION_KEYS.NFTS].length,
            updated: updatedCount,
            added: addedCount,
            processed: nfts.length
        };
    }

    async createNewPowerData() {
        return {
            [CONSTANTS.COLLECTION_KEYS.NFTS]: [],
            [CONSTANTS.COLLECTION_KEYS.COLLECTION_INFO]: {
                [CONSTANTS.COLLECTION_KEYS.NFT_QUANTITY]: 0,
                [CONSTANTS.COLLECTION_KEYS.LAST_UPDATED]: new Date().toISOString(),
                [CONSTANTS.COLLECTION_KEYS.POWER_CALCULATED]: new Date().toISOString(),
                [CONSTANTS.COLLECTION_KEYS.SYNERGY_CALCULATED]: new Date().toISOString(),
                [CONSTANTS.COLLECTION_KEYS.ORIGINAL_FILE]: 'all_nft_info.json',
                [CONSTANTS.COLLECTION_KEYS.POWER_VERSION]: CONSTANTS.MODULE.VERSION
            }
        };
    }

    clearCache() {
        this.cache.clear();
        this.logger.info('Кэш сервиса Power очищен');
    }
}

module.exports = new PowerService();