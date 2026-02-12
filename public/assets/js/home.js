// Глобальная функция для Telegram Auth
window.onTelegramAuth = async function(user) {
    try {
        console.log('Авторизация через Telegram:', user);
        
        // Отправляем данные на сервер
        const response = await api.post('/auth/telegram-login', user);
        
        if (response.success) {
            // Сохраняем данные пользователя
            localStorage.setItem('user', JSON.stringify(response.session.user));
            localStorage.setItem('accessLevel', response.session.accessLevel);
            
            // Обновляем UI
            updateUserUI(response.session.user);
            loadModules(response.session.availableModules);
            
            utils.showNotification('✅ Успешный вход!', 'success');
        }
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        utils.showNotification('❌ Ошибка при входе', 'error');
    }
};

// Проверка сессии при загрузке
async function checkSession() {
    try {
        const response = await api.get('/auth/check-session');
        
        if (response.success && response.session) {
            // Восстанавливаем сессию
            localStorage.setItem('user', JSON.stringify(response.session.user));
            localStorage.setItem('accessLevel', response.session.accessLevel);
            
            updateUserUI(response.session.user);
            loadModules(response.session.availableModules);
        } else {
            // Нет активной сессии - загружаем гостевые модули
            loadGuestModules();
        }
    } catch (error) {
        console.log('Нет активной сессии');
        loadGuestModules();
    }
}

// Обновление UI с информацией о пользователе
function updateUserUI(user) {
    const authSection = document.getElementById('auth-section');
    const userInfo = document.getElementById('user-info');
    const userGreeting = document.getElementById('user-greeting');
    
    if (user) {
        authSection.style.display = 'none';
        userInfo.style.display = 'flex';
        
        const displayName = user.username 
            ? `@${user.username}` 
            : `${user.first_name || ''} ${user.last_name || ''}`.trim();
        
        userGreeting.textContent = `👋 Привет, ${displayName}!`;
    } else {
        authSection.style.display = 'block';
        userInfo.style.display = 'none';
    }
}

// Загрузка модулей на основе доступности
function loadModules(availableModules) {
    const menuGrid = document.getElementById('menu-grid');
    menuGrid.innerHTML = '';
    
    // Конфигурация модулей
    const modulesConfig = {
        'power': {
            icon: '⚡',
            title: 'Подсчет Power',
            description: 'Расчет показателя Power для всех NFT коллекции. Анализ и обновление данных по редкости атрибутов.',
            link: null,
            enabled: true
        },
        'sort': {
            icon: '🔍',
            title: 'Сортировка NFT',
            description: 'Продвинутый поиск NFT по синергиям и редкостям. Фильтруйте по Skin Tone, уровню редкости и параметрам синергии.',
            link: '/sort',
            enabled: true
        },
        'TribeInfoCollector': {
            icon: '🔄',
            title: 'Сбор данных NFT',
            description: 'Автоматический сбор информации о NFT с блокчейна. Получение базовых данных, метаданных и генерация ссылок.',
            link: null,
            enabled: false
        },
        'TribeWalletInfoCollector': {
            icon: '👥',
            title: 'Инфо о кошельках Tribe',
            description: 'Анализ кошельков и NFT коллекций Tribe. Получение информации, фильтрация по атрибутам и пакетная обработка.',
            link: null,
            enabled: false
        },
        'orc-exchange': {
            icon: '🤝',
            title: 'Обмен орками',
            description: 'Оптимизация обмена карточками орков между игроками. Максимизация мощности команд через анализ бонусов за предметы.',
            link: '/orc-exchange',
            enabled: true
        }
    };
    
    // Фильтруем и отображаем доступные модули
    Object.entries(modulesConfig).forEach(([key, config]) => {
        // Проверяем доступность модуля
        const isAvailable = availableModules && availableModules[key]?.enabled;
        const isAlwaysVisible = key === 'power' || key === 'sort' || key === 'orc-exchange';
        
        if (isAvailable || (isAlwaysVisible && config.enabled)) {
            const moduleCard = createModuleCard(key, config);
            menuGrid.appendChild(moduleCard);
        }
    });
}

// Загрузка гостевых модулей (без авторизации)
function loadGuestModules() {
    const menuGrid = document.getElementById('menu-grid');
    menuGrid.innerHTML = '';
    
    // Только публичные модули
    const guestModules = [
        {
            icon: '🔍',
            title: 'Сортировка NFT',
            description: 'Продвинутый поиск NFT по синергиям и редкостям. Войдите через Telegram для полного доступа.',
            link: null,
            requiresAuth: true
        },
        {
            icon: '🤝',
            title: 'Обмен орками',
            description: 'Оптимизация обмена карточками орков. Требуется авторизация.',
            link: null,
            requiresAuth: true
        }
    ];
    
    guestModules.forEach(module => {
        const card = document.createElement('div');
        card.className = 'menu-card guest-card';
        if (module.requiresAuth) {
            card.innerHTML = `
                <div class="card-icon">🔒</div>
                <h2 class="card-title">${module.title}</h2>
                <p class="card-description">${module.description}</p>
                <div class="auth-required">Войдите через Telegram</div>
            `;
        }
        menuGrid.appendChild(card);
    });
    
    // Показываем виджет авторизации
    document.getElementById('auth-section').style.display = 'block';
}

// Создание карточки модуля
function createModuleCard(key, config) {
    const card = document.createElement(config.link ? 'a' : 'div');
    card.className = 'menu-card';
    
    if (config.link) {
        card.href = config.link;
    }
    
    card.innerHTML = `
        <div class="card-icon">${config.icon}</div>
        <h2 class="card-title">${config.title}</h2>
        <p class="card-description">${config.description}</p>
    `;
    
    return card;
}

// Обработчик выхода
document.addEventListener('DOMContentLoaded', async () => {
    // Инициализация
    await checkSession();
    
    // Обработчик кнопки выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await api.post('/auth/logout');
                localStorage.removeItem('user');
                localStorage.removeItem('accessLevel');
                
                updateUserUI(null);
                loadGuestModules();
                
                utils.showNotification('👋 Вы вышли из системы', 'info');
            } catch (error) {
                console.error('Ошибка при выходе:', error);
            }
        });
    }
});