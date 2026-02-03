// public/assets/js/api.js - полная версия с поддержкой polling
// API клиент для взаимодействия с сервером

const PowerAPI = {
    // Получить данные атрибутов Power
    getAttributesData: async () => {
        try {
            console.log('API: Загрузка данных атрибутов...');
            
            const response = await fetch('/api/power/attributes-data', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Данные атрибутов загружены');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных атрибутов:', error);
            throw error;
        }
    },

    // Получить данные о синергиях
    getSynergyData: async () => {
        try {
            console.log('API: Загрузка данных о синергиях...');
            
            const response = await fetch('/api/power/synergy-data', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Данные о синергиях загружены');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных о синергиях:', error);
            throw error;
        }
    },

    // Получить все NFT для расчета Power
    getNftsData: async () => {
        try {
            console.log('API: Загрузка данных NFT...');
            
            const response = await fetch('/api/power/nfts-data', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Данные NFT загружены');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных NFT:', error);
            throw error;
        }
    },

    // Получить данные с Power
    getNftsPowerData: async () => {
        try {
            console.log('API: Загрузка данных с Power...');
            
            const response = await fetch('/api/power/nfts-power-data', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Данные с Power загружены');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных с Power:', error);
            throw error;
        }
    },

    // Получить оригинальные данные NFT (alias для обратной совместимости)
    getOriginalNftsData: async () => {
        return await PowerAPI.getNftsData();
    },

    // Сохранить обновленные NFT
    saveNfts: async (nfts) => {
        try {
            console.log('API: Сохранение NFT данных...', { nftsCount: nfts?.length || 0 });
            
            const response = await fetch('/api/power/save-nfts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nfts })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ NFT данные сохранены:', data.message);
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка сохранения NFT данных:', error);
            throw error;
        }
    },

    // Запуск расчета Power
    calculatePower: async () => {
        try {
            console.log('API: Запуск расчета Power на сервере...');
            
            const response = await fetch('/api/power/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log(`✅ Расчет запущен: ${data.calculationId}`);
            console.log(`📊 Статус расчета: ${data.statusEndpoint || '/api/power/status/' + data.calculationId}`);
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка запуска расчета Power:', error);
            throw error;
        }
    },

    // Получить статус расчета
    getCalculationStatus: async (calculationId) => {
        try {
            console.log(`API: Получение статуса расчета ${calculationId}...`);
            
            const response = await fetch(`/api/power/status/${calculationId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Если 404, значит расчет завершен или не существует
                if (response.status === 404) {
                    return {
                        success: false,
                        error: 'Расчет не найден или завершен',
                        status: 'not_found'
                    };
                }
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log(`✅ Статус расчета получен: ${data.status || 'unknown'}, прогресс: ${data.progress || 0}%`);
            return data;
            
        } catch (error) {
            console.error(`❌ Ошибка получения статуса расчета:`, error);
            throw error;
        }
    },

    // Отменить расчет
    cancelCalculation: async (calculationId) => {
        try {
            console.log(`API: Отмена расчета ${calculationId}...`);
            
            const response = await fetch(`/api/power/cancel/${calculationId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log(`✅ Расчет отменен: ${calculationId}`);
            return data;
            
        } catch (error) {
            console.error(`❌ Ошибка отмены расчета:`, error);
            throw error;
        }
    },

    // Сравнение файлов
    compareFiles: async () => {
        try {
            console.log('API: Сравнение файлов...');
            
            const response = await fetch('/api/power/compare-files', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Сравнение файлов завершено');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка сравнения файлов:', error);
            throw error;
        }
    },

    // Экспорт только NFT с Power
    exportPowerOnly: async () => {
        try {
            console.log('API: Экспорт данных с Power...');
            
            const response = await fetch('/api/power/export-power-only', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Данные экспортированы');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка экспорта:', error);
            throw error;
        }
    },

    // Получить статус оптимизаций
    getOptimizationStatus: async () => {
        try {
            console.log('API: Получение статуса оптимизаций...');
            
            const response = await fetch('/api/power/optimization-status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Статус оптимизаций получен');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка получения статуса оптимизаций:', error);
            throw error;
        }
    },

    // Тестовый расчет для одного NFT
    testSingleNFT: async (nftIndex) => {
        try {
            console.log(`API: Тестовый расчет для NFT #${nftIndex}...`);
            
            const response = await fetch(`/api/power/test-single?nftIndex=${nftIndex}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Тестовый расчет завершен');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка тестового расчета:', error);
            throw error;
        }
    }
};

// Тестируем подключение к API при загрузке
async function testAPI() {
    try {
        console.log('🔍 Тестируем подключение к API...');
        
        // Простой ping запрос для проверки доступности API
        const response = await fetch('/api/power/attributes-data', {
            method: 'HEAD'
        });
        
        if (response.ok) {
            console.log(`✅ API доступен, статус: ${response.status}`);
        } else {
            console.warn(`⚠️ API ответил с ошибкой: ${response.status}`);
        }
        
        // Проверяем, что методы PowerAPI доступны
        if (window.PowerAPI && typeof PowerAPI.getAttributesData === 'function') {
            console.log('✅ API работает корректно');
        } else {
            console.error('❌ PowerAPI не инициализирован корректно');
        }
        
    } catch (error) {
        console.error('❌ API недоступен:', error);
    }
}

// Экспортируем API в глобальную область видимости
window.PowerAPI = PowerAPI;

// Запускаем тест API при загрузке
document.addEventListener('DOMContentLoaded', () => {
    testAPI();
    console.log('✅ API загружен и готов к использованию');
    console.log('PowerAPI методы:', Object.keys(PowerAPI).filter(key => typeof PowerAPI[key] === 'function'));
});

// Вспомогательная функция для форматирования чисел
window.formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Вспомогательная функция для показа уведомлений
window.showNotification = (message, type = 'info') => {
    // Простая реализация уведомлений
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 5 секунд
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Стили для уведомлений
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                animation: slideIn 0.3s ease;
                max-width: 300px;
                transition: all 0.3s ease;
            }
            .notification-success {
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                color: white;
            }
            .notification-error {
                background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                color: white;
            }
            .notification-warning {
                background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                color: white;
            }
            .notification-info {
                background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
                color: white;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .notification-icon {
                font-size: 18px;
            }
            .notification-message {
                flex: 1;
            }
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }
};