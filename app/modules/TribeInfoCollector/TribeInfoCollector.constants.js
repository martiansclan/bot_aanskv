module.exports = {
    // Версия и метаданные модуля
    MODULE: {
        NAME: 'TribeInfoCollector',
        VERSION: '1.0.0',
        DESCRIPTION: 'Модуль для сбора информации о NFT с блокчейна'
    },

    // API токены и ключи
    API_TOKENS: {
        API_TOKEN: process.env.API_TOKEN || '',
        TONAPI_KEY: process.env.TONAPI_KEY || '',
        TONCENTER_API_KEY: process.env.TONCENTER_API_KEY || ''
    },

    // Адреса коллекций
    COLLECTION_ADDRESSES: {
        UF: 'EQBGNoXXfQR07HdDhtkmIu1ojTTwcjB0EhHYOMSH3P7sZGJR',
        RAW: '0:463685d77d0474ec774386d92622ed688d34f07230741211d838c487dcfeec64'       
    },

    // Пути к файлам (относительные от этого файла)
    FILE_PATHS: {
        COLLECTED_DATA: '../../../nft_data/all_nft_info_collected.json',
        SUMMARY_DATA: '../../../nft_data/all_nft_info.json'
    },

    // Настройки сбора данных
    COLLECTION_SETTINGS: {
        BATCH_SIZE: 100,
        DELAY_BETWEEN_BATCHES: 1000,
        DELAY_BETWEEN_MESSAGES: 500,
        MAX_RETRIES: 3
    },

    // Статусы процесса сбора
    COLLECTION_STATUS: {
        NOT_STARTED: 0,
        STAGE_1: 1,
        STAGE_2: 2,
        STAGE_3: 3,
        COMPLETED: 4
    },

    // Сообщения об ошибках
    ERROR_MESSAGES: {
        PROCESS_ALREADY_RUNNING: 'Сбор данных уже запущен',
        PROCESS_NOT_RUNNING: 'Сбор данных не запущен',
        FILE_READ_ERROR: 'Ошибка чтения файла данных',
        FILE_WRITE_ERROR: 'Ошибка записи в файл данных',
        API_ERROR: 'Ошибка API запроса',
        INVALID_COLLECTION_INFO: 'Не удалось получить информацию о коллекции',
        DATA_DIR_NOT_FOUND: 'Директория данных не найдена',
        INVALID_API_KEY: 'Отсутствует API ключ',
        API_RATE_LIMIT: 'Превышен лимит запросов к API'
    },

    // Сообщения успеха
    SUCCESS_MESSAGES: {
        PROCESS_STARTED: 'Сбор данных запущен',
        PROCESS_STOPPED: 'Сбор данных остановлен',
        FILE_CREATED: 'Файл данных создан',
        DATA_SAVED: 'Данные успешно сохранены',
        SUMMARY_CREATED: 'Сводный файл создан',
        DATA_DIR_CREATED: 'Директория данных создана',
        API_CONNECTED: 'Успешное подключение к API'
    },

    // Коды HTTP статусов
    HTTP_STATUS: {
        OK: 200,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        RATE_LIMIT: 429,
        INTERNAL_SERVER_ERROR: 500
    },

    // API endpoints
    API_ENDPOINTS: {
        TON_CENTER: {
            BASE_URL: 'https://toncenter.com/api/v3',
            NFT_ITEMS: '/nft/items',
            COLLECTIONS: '/nft/collections',
            STATUS: '/status'
        },
        TONAPI: {
            BASE_URL: 'https://tonapi.io/v2',
            NFT_COLLECTIONS: '/nfts/collections',
            NFT_ITEMS: '/nfts/items',
            ACCOUNTS: '/accounts'
        }
    },

    // Ключи объектов NFT
    NFT_KEYS: {
        INDEX: 'index',
        ADDRESS: 'address',
        OWNER_ADDRESS: 'owner_address',
        USER_FRIENDLY_ADDRESS: 'user_friendly_address',
        NAME: 'name',
        IMAGE_URL: 'image_url',
        ATTRIBUTES: 'attributes',
        GETGEMS_URL: 'getgems_url',
        OWNER_URL: 'owner_url',
        STAGE1_COMPLETED: 'stage1_completed',
        STAGE2_COMPLETED: 'stage2_completed',
        STAGE3_COMPLETED: 'stage3_completed'
    },

    // Ключи для коллекций
    COLLECTION_KEYS: {
        NFTS: 'nfts',
        COLLECTION_INFO: 'collection_info',
        NFT_QUANTITY: 'nft_quantity',
        LAST_UPDATED: 'last_updated',
        LAST_PROCESSED_INDEX: 'last_processed_index',
        COLLECTION_NAME: 'collection_name',
        COLLECTION_ADDRESS: 'collection_address'
    },

    // Логгер теги
    LOG_TAGS: {
        INFO: 'INFO',
        ERROR: 'ERROR',
        WARN: 'WARN',
        MODULE_PREFIX: 'TribeInfoCollector',
        STAGE: 'STAGE',
        API: 'API'
    },

    // Настройки API
    API_SETTINGS: {
        TON_CENTER: {
            REQUIRES_KEY: true,
            RATE_LIMIT: 10 // запросов в секунду
        },
        TONAPI: {
            REQUIRES_KEY: true,
            RATE_LIMIT: 5 // запросов в секунду
        }
    },

    // Форматы адресов
    ADDRESS_FORMATS: {
        USER_FRIENDLY: 'user_friendly', // EQ...
        RAW: 'raw', // 0:...
        HEX: 'hex' // 0x...
    }
};