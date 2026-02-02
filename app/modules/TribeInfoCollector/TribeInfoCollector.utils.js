const axios = require('axios');
const CONSTANTS = require('./TribeInfoCollector.constants');
const fs = require('fs').promises;
const path = require('path');

class TribeInfoCollectorUtils {
    constructor() {
        this.config = require('./TribeInfoCollector.config');
        this.constants = CONSTANTS;
        
        // Создаем axios instance с API ключом если он есть
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        
        if (this.config.apiKeys.tonCenter) {
            headers['X-API-Key'] = this.config.apiKeys.tonCenter;
        }
        
        this.axiosInstance = axios.create({
            timeout: 30000,
            headers: headers
        });
    }

    /**
     * Выполняет запрос к TON Center API
     */
    async makeTonCenterRequest(url, params = {}) {
        try {
            const response = await this.axiosInstance.get(url, { params });
            
            if (response.data.error) {
                throw new Error(`TON Center API ошибка: ${response.data.error}`);
            }
            
            return response.data;
        } catch (error) {
            if (error.response?.status === 422) {
                const errorDetails = error.response.data?.error || 'Некорректный запрос';
                throw new Error(`Ошибка 422: ${errorDetails}`);
            }
            
            throw new Error(`TON Center API ошибка: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Получает информацию о коллекции (количество NFT)
     */
    async getCollectionInfo(collectionAddress) {
        try {
            console.log(`[INFO] Получение информации о коллекции: ${collectionAddress}`);
            
            // Правильный запрос для получения количества NFT
            const url = `${CONSTANTS.API_ENDPOINTS.TON_CENTER.BASE_URL}${CONSTANTS.API_ENDPOINTS.TON_CENTER.NFT_ITEMS}`;
            const params = {
                collection_address: collectionAddress,
                limit: 1,
                offset: 0
            };
            
            const data = await this.makeTonCenterRequest(url, params);
            
            if (!data.nft_items || data.nft_items.length === 0) {
                throw new Error('Коллекция не найдена или пуста');
            }
            
            // Получаем информацию о коллекции из первого NFT
            const firstNFT = data.nft_items[0];
            let totalNfts = 0;
            let collectionName = 'Неизвестно';
            
            if (firstNFT.collection && firstNFT.collection.next_item_index) {
                totalNfts = parseInt(firstNFT.collection.next_item_index);
                collectionName = firstNFT.collection.name || 'Без имени';
            }
            
            if (totalNfts === 0) {
                throw new Error('Не удалось определить количество NFT в коллекции');
            }
            
            console.log(`[INFO] Коллекция "${collectionName}", всего NFT: ${totalNfts}`);
            
            return {
                success: true,
                collection: firstNFT.collection || {},
                totalNfts: totalNfts,
                collectionName: collectionName
            };
            
        } catch (error) {
            console.error('[ERROR] Ошибка получения информации о коллекции:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Получает NFT предметы (пакетно)
     */
    async getNftItems(collectionAddress, limit = 100, offset = 0) {
        try {
            const url = `${CONSTANTS.API_ENDPOINTS.TON_CENTER.BASE_URL}${CONSTANTS.API_ENDPOINTS.TON_CENTER.NFT_ITEMS}`;
            const params = {
                collection_address: collectionAddress,
                limit: limit,
                offset: offset
            };
            
            const data = await this.makeTonCenterRequest(url, params);
            
            if (!data.nft_items) {
                console.log(`[WARN] Ответ не содержит nft_items`);
                return {
                    success: true,
                    nft_items: [],
                    total: 0
                };
            }
            
            return {
                success: true,
                nft_items: data.nft_items || [],
                total: data.total || data.nft_items.length
            };
            
        } catch (error) {
            console.error('[ERROR] Ошибка получения NFT предметов:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Получает адресную книгу (user-friendly адрес)
     */
    async getAddressBook(address) {
        try {
            const url = `${CONSTANTS.API_ENDPOINTS.TON_CENTER.BASE_URL}/addressBook`;
            const params = {
                address: address
            };
            
            const data = await this.makeTonCenterRequest(url, params);
            
            // API возвращает объект с ключами-адресами
            if (data && data[address]) {
                return {
                    success: true,
                    user_friendly: data[address].user_friendly || address
                };
            }
            
            return {
                success: false,
                user_friendly: address
            };
            
        } catch (error) {
            console.error(`[ERROR] Ошибка получения адресной книги для ${address}:`, error.message);
            return {
                success: false,
                user_friendly: address,
                error: error.message
            };
        }
    }

    /**
     * Получает метаданные NFT
     */
    async getNFTMetadata(address) {
        try {
            const url = `${CONSTANTS.API_ENDPOINTS.TON_CENTER.BASE_URL}/metadata`;
            const params = {
                address: address
            };
            
            const data = await this.makeTonCenterRequest(url, params);
            
            // API возвращает объект с ключами-адресами
            if (data && data[address]) {
                const metadata = data[address];
                return {
                    success: true,
                    metadata: metadata.token_info || []
                };
            }
            
            return {
                success: false,
                metadata: []
            };
            
        } catch (error) {
            console.error(`[ERROR] Ошибка получения метаданных для ${address}:`, error.message);
            return {
                success: false,
                metadata: [],
                error: error.message
            };
        }
    }

    /**
     * Тестовый запрос для проверки API
     */
    async testTonCenterAPI() {
        try {
            console.log('[INFO] Тестирование TON Center API...');
            
            // Простой тестовый запрос
            const testUrl = `${CONSTANTS.API_ENDPOINTS.TON_CENTER.BASE_URL}/status`;
            
            const response = await this.axiosInstance.get(testUrl);
            
            // Тест работы с коллекцией
            const collectionTest = await this.getCollectionInfo(this.config.collectionAddress);
            
            return {
                success: true,
                status: response.status,
                version: response.data?.version,
                collectionTest: collectionTest
            };
            
        } catch (error) {
            console.error('[ERROR] Тест API не пройден:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Тестовый запрос для получения одного NFT
     */
    async testSingleNFT() {
        try {
            const url = `${CONSTANTS.API_ENDPOINTS.TON_CENTER.BASE_URL}${CONSTANTS.API_ENDPOINTS.TON_CENTER.NFT_ITEMS}`;
            const params = {
                collection_address: this.config.collectionAddress,
                limit: 1,
                offset: 0
            };
            
            const response = await this.axiosInstance.get(url, { params });
            
            return {
                success: true,
                data: response.data
            };
            
        } catch (error) {
            console.error('[ERROR] Тест получения NFT не пройден:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Создает или проверяет директорию данных
     */
    async ensureDataDir() {
        try {
            const dataDir = path.join(__dirname, '../../../nft_data');
            await fs.mkdir(dataDir, { recursive: true });
            return { success: true, path: dataDir };
        } catch (error) {
            console.error('[ERROR] Ошибка создания директории данных:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Задержка выполнения
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Форматирует сообщение о прогрессе
     */
    formatProgressMessage(stage, processed, total, currentStage = null) {
        const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        const messages = {
            [CONSTANTS.COLLECTION_STATUS.STAGE_1]: 'Этап 1: Получение базовой информации',
            [CONSTANTS.COLLECTION_STATUS.STAGE_2]: 'Этап 2: Получение детальной информации',
            [CONSTANTS.COLLECTION_STATUS.STAGE_3]: 'Этап 3: Генерация ссылок',
            [CONSTANTS.COLLECTION_STATUS.COMPLETED]: 'Завершено'
        };

        const stageMessage = messages[currentStage || stage] || `Этап ${stage}`;
        
        return {
            message: `${stageMessage}`,
            progress: progress,
            details: {
                processed: processed,
                total: total,
                stage: stage
            }
        };
    }

    /**
     * Валидирует данные NFT
     */
    validateNFTData(nft) {
        if (!nft) return false;
        
        const requiredFields = [
            CONSTANTS.NFT_KEYS.INDEX,
            CONSTANTS.NFT_KEYS.ADDRESS
        ];

        return requiredFields.every(field => nft[field] !== undefined && nft[field] !== null);
    }
}

module.exports = new TribeInfoCollectorUtils();