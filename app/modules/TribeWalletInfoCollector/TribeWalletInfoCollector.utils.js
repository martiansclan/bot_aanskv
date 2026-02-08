const logger = require('../../core/utils/logger');

/**
 * Валидация адреса TON
 */
function isValidTonAddress(address) {
  if (typeof address !== 'string') return false;
  
  // Базовые проверки адреса TON
  const tonAddressRegex = /^[a-zA-Z0-9_-]{48}$/;
  return tonAddressRegex.test(address);
}

/**
 * Форматирование данных NFT для ответа
 */
function formatNftResponse(nftArray, options = {}) {
  const {
    includeMetadata = true,
    includeImage = true,
    limit = 50,
    offset = 0
  } = options;

  if (!Array.isArray(nftArray)) return [];

  const slicedArray = nftArray.slice(offset, offset + limit);

  return slicedArray.map(nft => {
    const formatted = {
      id: nft.address,
      name: nft.metadata?.name || 'Unnamed NFT',
      collection: nft.collection?.address
    };

    if (includeMetadata && nft.metadata) {
      formatted.metadata = {
        description: nft.metadata.description,
        attributes: nft.metadata.attributes,
        external_url: nft.metadata.external_url
      };
    }

    if (includeImage && nft.metadata?.image) {
      formatted.image = nft.metadata.image;
    }

    return formatted;
  });
}

/**
 * Генерация уникального ID запроса
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Обработка ошибок API
 */
function handleApiError(error) {
  if (error.response) {
    return {
      status: error.response.status,
      message: error.response.data?.error || 'API Error',
      data: error.response.data
    };
  } else if (error.request) {
    return {
      status: 503,
      message: 'Service Unavailable - No response from API',
      data: null
    };
  } else {
    return {
      status: 500,
      message: error.message || 'Internal Error',
      data: null
    };
  }
}

module.exports = {
  isValidTonAddress,
  formatNftResponse,
  generateRequestId,
  handleApiError
};