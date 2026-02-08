
const axios = require('axios');
const CONSTANTS = require('./TribeInfoCollector.constants');

class TribeInfoCollectorUtils {
    constructor() {
        this.config = require('./TribeInfoCollector.config');
        this.constants = CONSTANTS;
        
        // Создаем axios instance с API ключом
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
            throw new Error(`TON Center API ошибка: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Получает информацию о коллекции (количество NFT)
     */
    async getCollectionInfo(collectionAddress) {
        try {
            console.log(`[INFO] Получение информации о коллекции: ${collectionAddress}`);
            
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
     * Получает NFT предметы (пакетно) ВСЕ ДАННЫЕ В ОДНОМ ЗАПРОСЕ
     */
    async getNftItems(collectionAddress, limit = 100, offset = 0) {
        try {
            const url = `${CONSTANTS.API_ENDPOINTS.TON_CENTER.BASE_URL}${CONSTANTS.API_ENDPOINTS.TON_CENTER.NFT_ITEMS}`;
            const params = {
                collection_address: collectionAddress,
                limit: limit,
                offset: offset
            };
            
            console.log(`[API] Запрос NFT: offset=${offset}, limit=${limit}`);
            
            const data = await this.makeTonCenterRequest(url, params);
            
            // Логируем структуру ответа
            console.log(`[API] Ответ: NFT items=${data.nft_items?.length || 0}, ` +
                       `address_book записей=${data.address_book ? Object.keys(data.address_book).length : 0}, ` +
                       `metadata записей=${data.metadata ? Object.keys(data.metadata).length : 0}`);
            
            if (!data.nft_items) {
                console.log(`[WARN] Ответ не содержит nft_items`);
                return {
                    success: true,
                    nft_items: [],
                    address_book: {},
                    metadata: {},
                    total: 0
                };
            }
            
            return {
                success: true,
                nft_items: data.nft_items || [],
                address_book: data.address_book || {},
                metadata: data.metadata || {},
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
     * Тестовый запрос для проверки API
     */
    async testTonCenterAPI() {
        try {
            console.log('[INFO] Тестирование TON Center API...');
            
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
     * Задержка выполнения
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new TribeInfoCollectorUtils();
