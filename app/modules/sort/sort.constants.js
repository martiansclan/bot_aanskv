// Константы модуля сортировки

module.exports = {
    // Уровни синергий
    SYNERGY_LEVELS: ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C'],
    
    // Категории атрибутов
    ATTRIBUTE_CATEGORIES: {
        SKIN_TONE: 'Skin Tone',
        EARRINGS: 'Earrings',
        BRACELET: 'Bracelet',
        CUP: 'Cup',
        GLASSES: 'Glasses',
        PENDANT_CHAIN: 'Pendant Chain',
        ARMOR: 'Armor',
        HEART: 'Heart',
        CAP: 'Cap',
        EARRING: 'Earring',
        RING: 'Ring',
        SIGN: 'Sign',
        STICK: 'Stick',
        HAMSTER: 'Hamster'
    },
    
    // Уровни редкости
    RARITY_LEVELS: ['Mythical+', 'Mythical', 'Legendary', 'Epic', 'Common'],
    
    // Фильтры продажи
    SALE_FILTERS: {
        ALL: 'all',
        ON_SALE: 'onSale'
    },
    
    // Сообщения об ошибках
    ERROR_MESSAGES: {
        NO_DATA: 'Нет данных для сортировки',
        INVALID_FILTERS: 'Некорректные параметры фильтрации',
        FILE_NOT_FOUND: 'Файл данных не найден'
    }
};