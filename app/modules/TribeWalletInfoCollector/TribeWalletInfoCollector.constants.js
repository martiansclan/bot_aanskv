module.exports = {
  // Статусы операций
  STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },
  
  // Типы фильтров NFT
  FILTER_TYPES: {
    SKIN_TONE: 'skin_tone',
    ATTRIBUTE: 'attribute',
    COLLECTION: 'collection'
  },
  
  // Коды ошибок
  ERROR_CODES: {
    INVALID_WALLET: 'INVALID_WALLET_ADDRESS',
    API_ERROR: 'TON_API_ERROR',
    NFT_NOT_FOUND: 'NFT_NOT_FOUND',
    FILTER_ERROR: 'FILTER_ERROR'
  },
  
  // Сообщения
  MESSAGES: {
    WALLET_INFO_FETCHED: 'Информация о кошельке получена',
    NFT_FETCHED: 'NFT успешно получены',
    FILTER_APPLIED: 'Фильтр применен успешно'
  }
};