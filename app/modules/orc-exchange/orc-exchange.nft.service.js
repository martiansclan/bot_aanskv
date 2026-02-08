const fs = require('fs');
const path = require('path');
const logger = require('../../core/utils/logger');
const { Orc, Team, TeamOptimizer } = require('./orc-exchange.utils');

class NFTDataService {
    constructor() {
        this.nftData = null;
        this.userData = null;
        this.attributesData = null;
        this.orcTypeMapping = {
            'Orc Wen TGE': 1,
            'Orc Greeting': 2,
            'Orc Shoked': 3,
            'Orc In Love': 4,
            'Orc Capped': 5,
            'Orc To The Moon': 6,
            'Orc Do Something': 7
        };
        
        this.logoValues = [
            'Zargates Business',
            'Zargates',
            'Telegram',
            'Tribo Games',
            'Bitcoin',
            'Professor TON',
            'TON',
            'ETH',
            'RUB',
            'Dollar',
            'Elephant'
        ];
        
        this.logoEquivalents = {
            'Professor TON': 'TON',
            'TON': 'Professor TON',
            'Zargates Business': 'Zargates',
            'Zargates': 'Zargates Business'
        };
        
        this.initialized = false;
        this.availableSkinTones = [];
        this.defaultSkinTone = 'Martian';
    }

    // Инициализация сервиса
    async initialize() {
        try {
            logger.info('🔄 Инициализация NFT сервиса...');
            
            // Загружаем данные
            const nftLoaded = await this.loadNFTData();
            const userLoaded = await this.loadUserData();
            const attributesLoaded = await this.loadAttributesData();
            
            if (nftLoaded && userLoaded && attributesLoaded) {
                this.initialized = true;
                logger.success('✅ NFT сервис инициализирован');
                return true;
            } else {
                logger.error('❌ Не удалось загрузить данные NFT');
                return false;
            }
        } catch (error) {
            logger.error('❌ Ошибка инициализации NFT сервиса:', error);
            return false;
        }
    }

    // Загрузка данных NFT
    async loadNFTData() {
        try {
            const nftDataPath = path.join(__dirname, '../../../nft_data/all_nft_info_power.json');
            
            if (!fs.existsSync(nftDataPath)) {
                logger.error(`Файл NFT данных не найден: ${nftDataPath}`);
                return false;
            }
            
            const data = fs.readFileSync(nftDataPath, 'utf8');
            this.nftData = JSON.parse(data);
            logger.info(`📊 Загружены данные о ${this.nftData?.nfts?.length || 0} NFT`);
            return true;
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных NFT:', error);
            return false;
        }
    }

    // Загрузка данных пользователей
    async loadUserData() {
        try {
            const userDataPath = path.join(__dirname, '../../../nft_data/user_files/wallets_nft_info_1.json');
            
            if (!fs.existsSync(userDataPath)) {
                logger.error(`Файл данных пользователей не найден: ${userDataPath}`);
                return false;
            }
            
            const data = fs.readFileSync(userDataPath, 'utf8');
            this.userData = JSON.parse(data);
            logger.info(`👥 Загружены данные о ${this.userData?.members?.length || 0} пользователях`);
            return true;
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных пользователей:', error);
            return false;
        }
    }

    // Загрузка данных атрибутов
    async loadAttributesData() {
        try {
            const attributesPath = path.join(__dirname, '../../../nft_data/attributes_power_data.json');
            
            if (!fs.existsSync(attributesPath)) {
                logger.error(`Файл данных атрибутов не найден: ${attributesPath}`);
                return false;
            }
            
            const data = fs.readFileSync(attributesPath, 'utf8');
            this.attributesData = JSON.parse(data);
            
            // Извлекаем доступные Skin Tone
            if (this.attributesData?.attributes?.['Skin Tone']) {
                this.availableSkinTones = Object.keys(this.attributesData.attributes['Skin Tone']);
                logger.info(`🎨 Загружены ${this.availableSkinTones.length} вариантов Skin Tone`);
            }
            
            return true;
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных атрибутов:', error);
            return false;
        }
    }

    // Определение типа орка по имени
    getOrcTypeByName(name) {
        if (!name) return Math.floor(Math.random() * 7) + 1;
        
        for (const [orcName, typeId] of Object.entries(this.orcTypeMapping)) {
            if (name.includes(orcName)) {
                return typeId;
            }
        }
        
        // Если точного совпадения нет, определяем по ключевым словам
        const lowerName = name.toLowerCase();
        if (lowerName.includes('wen')) return 1;
        if (lowerName.includes('greeting')) return 2;
        if (lowerName.includes('shoked') || lowerName.includes('shocked')) return 3;
        if (lowerName.includes('love')) return 4;
        if (lowerName.includes('capped')) return 5;
        if (lowerName.includes('moon')) return 6;
        if (lowerName.includes('do something')) return 7;
        
        // Если не нашли, возвращаем случайный тип
        return Math.floor(Math.random() * 7) + 1;
    }

    // Извлечение Skin Tone из атрибутов
    extractSkinTone(attributes) {
        if (!attributes || !Array.isArray(attributes)) return '';
        
        for (const attr of attributes) {
            if (attr.trait_type === 'Skin Tone') {
                return attr.value || '';
            }
        }
        return '';
    }

    // Извлечение серьги из атрибутов
    extractEarrings(attributes) {
        if (!attributes || !Array.isArray(attributes)) return '';
        
        for (const attr of attributes) {
            if (attr.trait_type === 'Earring' || attr.trait_type === 'Earrings') {
                return attr.value || '';
            }
        }
        return '';
    }

    // Извлечение браслета из атрибутов
    extractBracelet(attributes) {
        if (!attributes || !Array.isArray(attributes)) return '';
        
        for (const attr of attributes) {
            if (attr.trait_type === 'Bracelet') {
                return attr.value || '';
            }
        }
        return '';
    }

    // Извлечение логотипа из атрибутов
    extractLogo(attributes) {
        if (!attributes || !Array.isArray(attributes)) return '';
        
        for (const attr of attributes) {
            if (this.logoValues.includes(attr.value)) {
                // Проверяем эквивалентность
                if (this.logoEquivalents[attr.value]) {
                    return this.logoEquivalents[attr.value];
                }
                return attr.value;
            }
        }
        return '';
    }

    // Нормализация логотипов для сравнения
    normalizeLogo(logo) {
        if (!logo) return '';
        
        const normalized = logo.trim();
        if (normalized === 'Professor TON' || normalized === 'TON') {
            return 'TON';
        }
        if (normalized === 'Zargates Business' || normalized === 'Zargates') {
            return 'Zargates';
        }
        return normalized;
    }

    // Поиск NFT по индексу
    findNFTByIndex(index) {
        if (!this.nftData?.nfts) return null;
        return this.nftData.nfts.find(nft => nft.index === index);
    }

    // Получение реальных данных игроков с фильтрацией по Skin Tone
    async getRealPlayerData(skinTone = null) {
        if (!this.initialized) {
            logger.warning('NFT сервис не инициализирован, пытаемся инициализировать...');
            await this.initialize();
        }

        if (!this.userData?.members || !this.nftData?.nfts) {
            throw new Error('Не удалось загрузить данные NFT или пользователей');
        }

        // Используем переданный Skin Tone или значение по умолчанию
        const selectedSkinTone = skinTone || this.defaultSkinTone;
        logger.info(`🎨 Фильтрация по Skin Tone: ${selectedSkinTone}`);
        
        const players = [];
        
        this.userData.members.forEach((member, index) => {
            const cards = [];
            
            // Обрабатываем каждый NFT пользователя
            if (member.TribeNFT && Array.isArray(member.TribeNFT)) {
                member.TribeNFT.forEach(nftIndex => {
                    const nft = this.findNFTByIndex(nftIndex);
                    if (nft) {
                        // Извлекаем Skin Tone
                        const skinToneValue = this.extractSkinTone(nft.attributes || []);
                        
                        // Пропускаем NFT если Skin Tone не соответствует выбранному
                        if (selectedSkinTone && skinToneValue !== selectedSkinTone) {
                            return;
                        }
                        
                        // Определяем тип орка
                        const orcType = this.getOrcTypeByName(nft.name);
                        
                        // Извлекаем атрибуты
                        const earrings = this.extractEarrings(nft.attributes || []);
                        const bracelet = this.extractBracelet(nft.attributes || []);
                        const logo = this.extractLogo(nft.attributes || []);
                        
                        // Создаем объект орка
                        const orc = {
                            id: nft.index,
                            type: orcType,
                            typeName: this.getOrcTypeName(orcType),
                            power: nft.power_total || 0,
                            earrings: earrings,
                            amulet: this.normalizeLogo(logo), // Используем logo как амулет
                            bracelet: bracelet,
                            skinTone: skinToneValue,
                            nftData: {
                                name: nft.name,
                                image_url: nft.image_url,
                                attributes: nft.attributes || []
                            }
                        };
                        
                        cards.push(orc);
                    } else {
                        logger.warning(`❌ NFT с индексом ${nftIndex} не найден для пользователя ${member.MemberNickname}`);
                    }
                });
            }
            
            // Если у пользователя есть карточки, добавляем его
            if (cards.length > 0) {
                players.push({
                    id: index,
                    name: member.MemberNickname || `Игрок ${index + 1}`,
                    wallet: member.Wallet,
                    balance: member.balance,
                    cards: cards
                });
            } else {
                logger.warning(`❌ У игрока ${member.MemberNickname} нет NFT карточек с Skin Tone: ${selectedSkinTone}`);
            }
        });
        
        logger.info(`✅ Создано ${players.length} игроков с реальными данными (Skin Tone: ${selectedSkinTone})`);
        return {
            players,
            selectedSkinTone,
            availableSkinTones: this.availableSkinTones
        };
    }

    // Получение названия типа орка
    getOrcTypeName(typeId) {
        const typeNames = {
            1: 'Wen TGE',
            2: 'Greeting',
            3: 'Shoked',
            4: 'In Love',
            5: 'Capped',
            6: 'To The Moon',
            7: 'Do Something'
        };
        return typeNames[typeId] || `Тип ${typeId}`;
    }

    // Получение информации о конкретном NFT для отображения
    getNFTDetails(index) {
        const nft = this.findNFTByIndex(index);
        if (!nft) return null;
        
        return {
            index: nft.index,
            name: nft.name,
            image_url: nft.image_url,
            power_total: nft.power_total,
            attributes: nft.attributes || [],
            getgems_url: nft.getgems_url,
            owner_url: nft.owner_url,
            orcType: this.getOrcTypeByName(nft.name),
            orcTypeName: this.getOrcTypeName(this.getOrcTypeByName(nft.name)),
            skinTone: this.extractSkinTone(nft.attributes || []),
            earrings: this.extractEarrings(nft.attributes || []),
            bracelet: this.extractBracelet(nft.attributes || []),
            logo: this.normalizeLogo(this.extractLogo(nft.attributes || []))
        };
    }

    // Получение доступных Skin Tone
    getAvailableSkinTones() {
        return this.availableSkinTones;
    }

    // Получение значения по умолчанию
    getDefaultSkinTone() {
        return this.defaultSkinTone;
    }

    // Остановка сервиса
    async shutdown() {
        this.nftData = null;
        this.userData = null;
        this.attributesData = null;
        this.initialized = false;
        logger.info('🛑 NFT сервис остановлен');
    }
}

// Экспорт синглтона
const nftDataService = new NFTDataService();

module.exports = {
    nftDataService,
    NFTDataService
};