// Контроллер модуля сортировки
const sortService = require('./sort.service');

// Пытаемся загрузить логгер, если не получается - используем простой
let logger;
try {
    logger = require('../../../core/utils/logger').child({ module: 'sort.controller' });
} catch (error) {
    logger = {
        info: (msg, ...args) => console.log(`[SORT CONTROLLER] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[SORT CONTROLLER ERROR] ${msg}`, ...args)
    };
}

class SortController {
    constructor() {
        this.config = require('./sort.config');
        this.logger = logger;
    }
    
    async getFilterOptions(req, res) {
        try {
            this.logger.info('GET /api/sort/filter-options');
            
            const options = await sortService.getFilterOptions();
            
            res.json({
                success: true,
                data: options,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.logger.error('Ошибка получения опций фильтрации:', error);
            res.status(500).json({
                success: false,
                error: 'Ошибка получения опций фильтрации',
                details: error.message
            });
        }
    }
    
    async sortNFTs(req, res) {
        try {
            this.logger.info('POST /api/sort/sort');
            
            const { filters, page, searchQuery } = req.body;
            
            // Добавляем поисковый запрос в фильтры
            const enhancedFilters = {
                ...filters,
                searchQuery: searchQuery || ''
            };
            
            // Базовая валидация
            if (!enhancedFilters) {
                return res.status(400).json({
                    success: false,
                    error: 'Не указаны фильтры'
                });
            }
            
            // Сбрасываем страницу на 1, если это новый поиск
            const currentPage = page || 1;
            
            // Выполняем сортировку
            const result = await sortService.sortNFTs(enhancedFilters, currentPage);
            
            res.json(result);
            
        } catch (error) {
            this.logger.error('Ошибка сортировки NFT:', error);
            res.status(500).json({
                success: false,
                error: 'Ошибка сортировки NFT',
                details: error.message
            });
        }
    }
    
    // Новый метод для быстрого поиска
    async quickSearch(req, res) {
        try {
            const { query } = req.query;
            this.logger.info('GET /api/sort/quick-search', { query });
            
            if (!query || query.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Пустой поисковый запрос'
                });
            }
            
            // Загружаем данные если нужно
            if (!sortService.dataCache.nfts) {
                await sortService.initialize();
            }
            
            // Используем быстрый поиск через индекс
            const results = sortService.searchNFTsFast(query);
            
            // Форматируем результат
            const formattedResults = sortService.formatNFTsForClient(results.slice(0, 10)); // Первые 10
            
            res.json({
                success: true,
                data: formattedResults,
                total: results.length,
                query: query
            });
            
        } catch (error) {
            this.logger.error('Ошибка быстрого поиска:', error);
            res.status(500).json({
                success: false,
                error: 'Ошибка поиска',
                details: error.message
            });
        }
    }
}

module.exports = new SortController();