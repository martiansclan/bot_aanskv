// app/modules/power/power.constants.js

module.exports = {
    // Версия и метаданные модуля
    MODULE: {
        NAME: 'power',
        VERSION: '2.0.0',
        DESCRIPTION: 'Модуль расчета Power для NFT с поддержкой синергий и оптимизированной обработкой'
    },

    // Пути к файлам (относительные от этого файла)
    FILE_PATHS: {
        ORIGINAL_NFTS: '../../../nft_data/all_nft_info.json',
        POWER_NFTS: '../../../nft_data/all_nft_info_power.json',
        SYNERGY_DATA: '../../../nft_data/synergy_state.json',
        ATTRIBUTES_POWER: '../../../nft_data/attributes_power_data.json',
        CONSTANTS: __filename // Путь к самому файлу констант
    },

    // Оптимизированные настройки для пакетной обработки
    OPTIMIZATION: {
        CHUNK_SIZE: 1000,           // Размер чанка для сохранения
        PROGRESS_UPDATE_EVERY: 500, // Обновлять прогресс каждые 500 NFT
        CONSOLE_LOG_EVERY: 1000,    // Логировать в консоль каждые 1000 NFT
        DELAY_BETWEEN_CHUNKS: 100,  // Задержка между чанками (мс)
        MAX_RETRIES: 3,             // Максимальное количество попыток сохранения
        MEMORY_CHECK_EVERY: 5000    // Проверять память каждые 5000 NFT
    },

    // Значения power для синергий
    SYNERGY_POWER_VALUES: {
        TWO_ATTRIBUTES: 100,    // Сила за 2 совпадающих атрибута
        THREE_ATTRIBUTES: 300   // Сила за 3 совпадающих атрибута
    },

    // Исключаемые атрибуты из расчета синергий
    EXCLUDED_ATTRIBUTES: [
        'Skin Tone'        
    ],

    // Статусы и сообщения
    STATUS: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        IN_PROGRESS: 'in_progress'
    },

    // Сообщения об ошибках
    ERROR_MESSAGES: {
        INVALID_NFT_ARRAY: 'Неверные данные для сохранения: требуется массив NFT',
        INVALID_NFT_DATA: 'Неверный формат данных NFT',
        FILE_NOT_FOUND: 'Файл данных не найден',
        FILE_READ_ERROR: 'Ошибка чтения файла данных',
        FILE_WRITE_ERROR: 'Ошибка записи файла данных',
        CALCULATION_ERROR: 'Ошибка расчета Power',
        SYNERGY_CALCULATION_ERROR: 'Ошибка расчета синергий',
        CACHE_CLEAR_DENIED: 'Доступ запрещен для очистки кэша',
        CHUNK_SAVE_FAILED: 'Не удалось сохранить чанк после нескольких попыток',
        CHUNK_PROCESSING_ERROR: 'Ошибка обработки чанка',
        MEMORY_LIMIT_EXCEEDED: 'Превышен лимит памяти при обработке'
    },

    // Сообщения успеха
    SUCCESS_MESSAGES: {
        POWER_CALCULATED: 'Расчет Power завершен успешно',
        DATA_SAVED: 'Данные успешно сохранены',
        CACHE_CLEARED: 'Кэш успешно очищен',
        EXPORT_COMPLETED: 'Экспорт данных завершен',
        CHUNK_SAVED: 'Чанк успешно сохранен',
        CHUNK_PROCESSED: 'Чанк обработан',
        MEMORY_OPTIMIZED: 'Память оптимизирована'
    },

    // Коды HTTP статусов
    HTTP_STATUS: {
        OK: 200,
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_SERVER_ERROR: 500,
        SERVICE_UNAVAILABLE: 503
    },

    // Имена заголовков
    HEADERS: {
        CONTENT_DISPOSITION: 'Content-Disposition',
        CONTENT_TYPE: 'Content-Type',
        JSON_TYPE: 'application/json'
    },

    // Ключи для объектов NFT
    NFT_KEYS: {
        INDEX: 'index',
        ATTRIBUTES: 'attributes',
        POWER_ATTRIBUTES: 'power_attributes',
        POWER_TOTAL: 'power_total',
        SYNERGY_POWER: 'synergy_power',
        ATTRIBUTE_SYNERGY: 'attribute_synergy',
        TRAIT_TYPE: 'trait_type',
        VALUE: 'value',
        RARITY: 'rarity',
        POWER: 'power'
    },

    // Ключи для коллекций
    COLLECTION_KEYS: {
        NFTS: 'nfts',
        COLLECTION_INFO: 'collection_info',
        NFT_QUANTITY: 'nft_quantity',
        LAST_UPDATED: 'last_updated',
        POWER_CALCULATED: 'power_calculated',
        SYNERGY_CALCULATED: 'synergy_calculated',
        ORIGINAL_FILE: 'original_file',
        POWER_VERSION: 'power_version',
        SYNERGY_TYPES_COUNT: 'synergy_types_count',
        NFTS_WITH_POWER: 'nfts_with_power',
        NFTS_WITH_SYNERGY: 'nfts_with_synergy'
    },

    // Имена файлов для экспорта
    EXPORT_FILES: {
        POWER_ONLY: 'nfts_with_power.json',
        POWER_FULL: 'all_nft_info_power.json'
    },

    // Ключи окружения
    ENV_KEYS: {
        NODE_ENV: 'NODE_ENV',
        CACHE_CLEAR_SECRET: 'CACHE_CLEAR_SECRET'
    },

    // Режимы окружения
    ENVIRONMENT: {
        DEVELOPMENT: 'development',
        PRODUCTION: 'production',
        TEST: 'test'
    },

    // Логгер теги
    LOG_TAGS: {
        INFO: 'INFO',
        ERROR: 'ERROR',
        WARN: 'WARN',
        MODULE_PREFIX: 'power',
        CHUNK: 'CHUNK',
        OPTIMIZATION: 'OPTIMIZATION',
        MEMORY: 'MEMORY'
    },

    // Лимиты памяти (в байтах)
    MEMORY_LIMITS: {
        WARNING: 500 * 1024 * 1024, // 500MB - предупреждение
        CRITICAL: 800 * 1024 * 1024 // 800MB - критический уровень
    }
};