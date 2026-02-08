// app/modules/TribeWalletInfoCollector/TribeWalletInfoCollector.service.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('./TribeWalletInfoCollector.config.js');
const logger = require('../../core/utils/logger');

class TribeWalletInfoCollectorService {
    constructor() {
        this.name = 'TribeWalletInfoCollector';
        this.initialized = false;
        
        this.ensureDataDir();
    }

    async ensureDataDir() {
        try {
            await fs.mkdir(config.dataDir, { recursive: true });
        } catch (error) {
            logger.error('Ошибка создания папки для данных:', error);
        }
    }

    async initialize() {
        logger.info(`Инициализация сервиса ${this.name}...`);
        this.initialized = true;
        logger.success(`Сервис ${this.name} инициализирован`);
        return true;
    }

    /**
     * Сбор информации о кошельках и сохранение в файл
     */
    async collectAndSaveWalletsInfo(walletsData, userId) {
        try {
            const results = [];
            
            for (let i = 0; i < walletsData.length; i++) {
                const walletAddress = walletsData[i];
                
                if (!walletAddress) {
                    logger.warn(`Пропущен кошелек: пустой адрес`);
                    continue;
                }

                if (!this.isValidTonAddress(walletAddress)) {
                    logger.warn(`Невалидный адрес кошелька: ${walletAddress}`);
                    results.push({
                        nickname: this.generateNickname(walletAddress),
                        wallet: walletAddress,
                        success: false,
                        error: 'Невалидный адрес кошелька'
                    });
                    continue;
                }

                try {
                    // Задержка между запросами для избежания 429 ошибки
                    if (i > 0) {
                        await this.delay(config.api.delayBetweenRequests);
                    }
                    
                    // Получаем данные кошелька
                    const walletInfo = await this.fetchWalletData(walletAddress);
                    
                    // Получаем NFT кошелька ТОЛЬКО из нужной коллекции
                    const nfts = await this.fetchWalletNFTs(walletAddress);
                    
                    // Извлекаем только индексы NFT
                    const nftIndices = nfts
                        .map(nft => nft.index)
                        .filter(index => index != null)
                        .map(index => parseInt(index));
                    
                    // Генерируем никнейм из последних 4 символов
                    const nickname = this.generateNickname(walletAddress);
                    
                    // Формируем результат
                    const result = {
                        nickname,
                        wallet: walletAddress,
                        success: true,
                        data: {
                            balance: walletInfo.balance ? (walletInfo.balance / 1000000000).toFixed(9) : "0",
                            status: walletInfo.status || 'unknown',
                            last_activity: walletInfo.last_activity ? 
                                new Date(walletInfo.last_activity * 1000).toISOString() : null,
                            tribeNFTs: nftIndices
                        }
                    };
                    
                    results.push(result);
                    logger.info(`Кошелек ${walletAddress}: ${nftIndices.length} NFT`);
                    
                } catch (error) {
                    logger.error(`Ошибка для ${walletAddress}:`, error.message);
                    results.push({
                        nickname: this.generateNickname(walletAddress),
                        wallet: walletAddress,
                        success: false,
                        error: error.message
                    });
                    
                    // При 429 ошибке увеличиваем задержку
                    if (error.message.includes('429')) {
                        await this.delay(config.api.delayBetweenRequests * 2);
                    }
                }
            }

            // Сохраняем в файл
            const filePath = await this.saveToFile(results, userId);
            
            return {
                success: true,
                total: walletsData.length,
                processed: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results: results,
                filePath: filePath
            };
            
        } catch (error) {
            logger.error('Ошибка сбора данных:', error);
            throw error;
        }
    }

    /**
     * Загрузка кошельков из файла
     */
    async loadWalletsFromFile(userId) {
        try {
            const fileName = `wallets_info_${userId}.json`;
            const filePath = path.join(config.dataDir, fileName);
            
            // Проверяем существование файла
            await fs.access(filePath);
            
            // Читаем файл
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            
            // Извлекаем адреса кошельков из структуры
            if (data.members && Array.isArray(data.members)) {
                const wallets = data.members
                    .map(member => member.Wallet)
                    .filter(wallet => wallet && this.isValidTonAddress(wallet));
                
                logger.info(`Загружено ${wallets.length} кошельков из файла ${fileName}`);
                return wallets;
            }
            
            return [];
            
        } catch (error) {
            logger.warn(`Не удалось загрузить кошельки из файла: ${error.message}`);
            return [];
        }
    }

    /**
     * Сохранение кошельков в файл
     */
    async saveWalletsToFile(wallets, userId) {
        try {
            const fileName = `wallets_info_${userId}.json`;
            const filePath = path.join(config.dataDir, fileName);
            
            // Формируем структуру
            const data = {
                generated_at: new Date().toISOString(),
                members: wallets.map(wallet => ({
                    MemberNickname: this.generateNickname(wallet),
                    Wallet: wallet
                }))
            };
            
            // Сохраняем в файл
            await fs.writeFile(
                filePath, 
                JSON.stringify(data, null, 2),
                'utf-8'
            );
            
            logger.info(`Кошельки сохранены в файл: ${filePath}`);
            return filePath;
            
        } catch (error) {
            logger.error('Ошибка сохранения кошельков в файл:', error);
            throw error;
        }
    }

    /**
     * Получение данных кошелька
     */
    async fetchWalletData(accountId) {
        try {
            const response = await axios.get(
                `${config.api.baseUrl}/accounts/${accountId}`,
                { timeout: config.api.timeout }
            );
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                throw new Error(`Ошибка API: Request failed with status code 429`);
            }
            throw new Error(`Ошибка API: ${error.message}`);
        }
    }

    /**
     * Получение NFT кошелька ИЗ КОНКРЕТНОЙ КОЛЛЕКЦИИ
     */
    async fetchWalletNFTs(accountId) {
        try {
            const response = await axios.get(
                `${config.api.baseUrl}/accounts/${accountId}/nfts`,
                {
                    params: {
                        collection: config.collections.default
                    },
                    timeout: config.api.timeout
                }
            );
            
            return response.data.nft_items || [];
        } catch (error) {
            logger.error('Ошибка получения NFT:', error.message);
            return [];
        }
    }

    /**
     * Сохранение данных в JSON файл
     */
    async saveToFile(data, userId) {
        try {
            const fileName = `wallets_nft_info_${userId}.json`;
            const filePath = path.join(config.dataDir, fileName);
            
            // Форматируем данные
            const formattedData = {
                generated_at: new Date().toISOString(),
                members: data.map(item => ({
                    MemberNickname: item.nickname,
                    Wallet: item.wallet,
                    ...(item.success ? {
                        balance: item.data.balance,
                        status: item.data.status,
                        last_activity: item.data.last_activity,
                        TribeNFT: item.data.tribeNFTs
                    } : {
                        error: item.error
                    })
                }))
            };
            
            // Сохраняем в файл
            await fs.writeFile(
                filePath, 
                JSON.stringify(formattedData, null, 2),
                'utf-8'
            );
            
            logger.info(`Файл сохранен: ${filePath}`);
            return filePath;
            
        } catch (error) {
            logger.error('Ошибка сохранения файла:', error);
            throw error;
        }
    }

    /**
     * Генерация никнейма из последних 4 символов адреса
     */
    generateNickname(address) {
        if (!address || address.length < 4) return 'unknown';
        return address.slice(-4);
    }

    /**
     * Валидация адреса TON
     */
    isValidTonAddress(address) {
        if (typeof address !== 'string') return false;
        const tonAddressRegex = /^[a-zA-Z0-9_-]{48}$/;
        return tonAddressRegex.test(address);
    }

    /**
     * Задержка между запросами
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Проверка работоспособности сервиса
     */
    async healthCheck() {
        return {
            status: this.initialized ? 'healthy' : 'unhealthy',
            service: this.name,
            timestamp: new Date().toISOString(),
            dataDir: config.dataDir
        };
    }
}

module.exports = new TribeWalletInfoCollectorService();