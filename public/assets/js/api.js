// public/assets/js/api.js
// ===== API ДЛЯ БРАУЗЕРА =====

// Создаем простой объект API без рекурсии
const PowerAPI = {
    // Получение данных атрибутов
    async getAttributesData() {
        try {
            console.log('API: Загрузка данных атрибутов...');
            const response = await fetch('/api/power/attributes-data');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка получения данных атрибутов:', error);
            throw error;
        }
    },
    
    // Получение данных о синергиях
    async getSynergyData() {
        try {
            console.log('API: Загрузка данных синергий...');
            const response = await fetch('/api/power/synergy-data');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка получения данных синергий:', error);
            throw error;
        }
    },
    
    // Получение всех NFT
    async getNftsData() {
        try {
            console.log('API: Загрузка данных NFT...');
            const response = await fetch('/api/power/nfts-data');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка получения данных NFT:', error);
            throw error;
        }
    },
    
    // Получение данных с Power
    async getNftsPowerData() {
        try {
            console.log('API: Загрузка данных с Power...');
            const response = await fetch('/api/power/nfts-power-data');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка получения данных с Power:', error);
            throw error;
        }
    },
    
    // Загрузка оригинальных данных (без Power) - ВАЖНО: не вызывает getNftsData()!
    async getOriginalNftsData() {
        try {
            console.log('API: Загрузка оригинальных данных...');
            const response = await fetch('/api/power/nfts-data');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка получения оригинальных данных:', error);
            throw error;
        }
    },
    
    // Сохранение обновленных NFT (ИСПРАВЛЕННАЯ ВЕРСИЯ)
    async saveNfts(nfts) {
        try {
            console.log(`API: Отправка ${nfts.length} NFT на сервер...`);
            
            // Проверяем, что nfts - это массив
            if (!Array.isArray(nfts)) {
                throw new Error('Параметр nfts должен быть массивом');
            }
            
            const response = await fetch('/api/power/save-nfts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nfts: nfts })
            });
            
            console.log('API: Ответ сервера:', response.status, response.statusText);
            
            // Проверяем тип контента
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('API: Сервер вернул не JSON:', text.substring(0, 200));
                throw new Error(`Сервер вернул не JSON: ${text.substring(0, 100)}...`);
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('API: Ошибка сервера:', errorData);
                throw new Error(errorData.error || `Ошибка ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`API: Чанк сохранен: ${result.message || 'успешно'}`);
            return result;
            
        } catch (error) {
            console.error('API: Ошибка сохранения NFT:', error);
            throw error;
        }
    },
    
    // Расчет Power на сервере
    async calculatePower() {
        try {
            console.log('API: Запуск расчета Power на сервере...');
            const response = await fetch('/api/power/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Ошибка ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка расчета Power:', error);
            throw error;
        }
    },
    
    // Сравнение файлов
    async compareFiles() {
        try {
            console.log('API: Сравнение файлов...');
            const response = await fetch('/api/power/compare-files');
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка сравнения файлов:', error);
            throw error;
        }
    },
    
    // Экспорт только NFT с Power
    async exportPowerOnly() {
        try {
            console.log('API: Экспорт NFT с Power...');
            const response = await fetch('/api/power/export-power-only');
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API: Ошибка экспорта:', error);
            throw error;
        }
    }
};

// Экспортируем API для использования в других файлах
window.PowerAPI = PowerAPI;

// Оставляем старые функции для совместимости
window.formatNumber = formatNumber;
window.formatDate = formatDate;



console.log('✅ API загружен и готов к использованию');
console.log('PowerAPI методы:', Object.keys(PowerAPI));

// Тест API при загрузке
async function testAPIConnection() {
    try {
        console.log('🔍 Тестируем подключение к API...');
        const test = await fetch('/api/power/attributes-data');
        console.log('✅ API доступен, статус:', test.status);
        
        if (test.ok) {
            console.log('✅ API работает корректно');
        }
    } catch (error) {
        console.warn('⚠️ API тест не удался:', error.message);
    }
}

// Запускаем тест через секунду
setTimeout(testAPIConnection, 1000);