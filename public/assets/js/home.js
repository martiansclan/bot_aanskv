// public/assets/js/home.js
// Главная страница
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
});

// Настраиваем обработчики событий
function setupEventListeners() {
    // Статистика (вторая карточка)
    const statsCard = document.querySelector('.menu-card:nth-child(2)');
    if (statsCard) {
        statsCard.addEventListener('click', loadDetailedStats);
    }
    
    // Мои результаты (третья карточка)
    const resultsCard = document.querySelector('.menu-card:nth-child(3)');
    if (resultsCard) {
        resultsCard.addEventListener('click', showUserResults);
    }
    
    // Просмотр NFT (четвертая карточка)
    const nftCard = document.querySelector('.menu-card:nth-child(4)');
    if (nftCard) {
        nftCard.addEventListener('click', showNftBrowser);
    }
}

// Загрузка детальной статистики
async function loadDetailedStats() {
    try {
        // TODO: Реализовать API статистики
        // const response = await fetch('/api/stats');
        // const data = await response.json();
        
        // Временная заглушка
        showNotification('Модуль статистики в разработке', 'info');
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        showNotification('Не удалось загрузить статистику', 'error');
    }
}

// Показ статистики в модальном окне
function showStatsModal(stats) {
    // Эта функция пока не используется
    // Можно оставить для будущего
}

// Показ результатов пользователя
function showUserResults() {
    showNotification('Эта функция в разработке', 'info');
}

// Просмотр NFT
function showNftBrowser() {
    showNotification('Эта функция в разработке', 'info');
}