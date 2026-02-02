// TribeInfoCollector.js - ОСНОВНОЙ ФАЙЛ ДЛЯ РАБОТЫ С МОДУЛЕМ

// ========== КОНФИГУРАЦИЯ ==========
const API_BASE = '/api/TribeInfoCollector';
let calculationId = null;
let websocket = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
let collectionIsRunning = false; // Флаг состояния процесса сбора

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С API ==========

/**
 * Выполняет API запрос
 */
async function apiCall(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE}${endpoint}`;
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ошибка ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`❌ Ошибка API запроса ${endpoint}:`, error);
        logToConsole(`❌ Ошибка API: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Инициализация WebSocket соединения
 */
function initWebSocket() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        return;
    }
    
    const wsUrl = `ws://${window.location.host}/api/TribeInfoCollector/ws`;
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
        console.log('✅ WebSocket подключен к Tribe Info Collector');
        isConnected = true;
        reconnectAttempts = 0;
        updateConnectionStatus(true);
        
        // Подписываемся на расчет если есть ID
        if (calculationId) {
            subscribeToCalculation(calculationId);
        }
    };
    
    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('❌ Ошибка обработки WebSocket сообщения:', error);
        }
    };
    
    websocket.onclose = (event) => {
        console.log('🔌 WebSocket отключен:', event.code, event.reason);
        isConnected = false;
        updateConnectionStatus(false);
        
        // Пытаемся переподключиться
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Попытка переподключения ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
            logToConsole(`🔄 Переподключение WebSocket... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'info');
            setTimeout(initWebSocket, RECONNECT_DELAY);
        }
    };
    
    websocket.onerror = (error) => {
        console.error('❌ WebSocket ошибка:', error);
        isConnected = false;
        updateConnectionStatus(false);
    };
}

/**
 * Подписывается на расчет через WebSocket
 */
function subscribeToCalculation(calcId) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ WebSocket не подключен, подписка невозможна');
        return;
    }
    
    const message = {
        type: 'subscribe',
        calculationId: calcId
    };
    
    websocket.send(JSON.stringify(message));
    console.log(`📡 Подписались на расчет ${calcId}`);
}

/**
 * Обрабатывает сообщения WebSocket
 */
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'progress':
            handleProgressUpdate(data);
            break;
            
        case 'complete':
            handleComplete(data);
            break;
            
        case 'error':
            handleError(data);
            break;
            
        case 'pong':
            // Ответ на ping, можно игнорировать
            break;
            
        default:
            console.log('📨 Получено неизвестное WebSocket сообщение:', data);
    }
}

/**
 * Обрабатывает обновление прогресса (упрощенная версия)
 */
function handleProgressUpdate(data) {
    const { progress, message, details } = data;
    
    // Общий прогресс-бар
    updateProgressBar(progress);
    updateStatus(message);
    
    // Обновляем состояние процесса
    collectionIsRunning = data.status === 'in_progress';
    updateButtonStates();
    
    // Логируем важные обновления
    if (progress % 10 === 0 || progress >= 100) {
        logToConsole(`📊 Прогресс: ${progress}% - ${message}`, 'progress');
    }
}

/**
 * Обрабатывает завершение расчета (упрощенная версия)
 */
function handleComplete(data) {
    const { result, message } = data;
    
    logToConsole(`✅ ${message}`, 'success');
    
    // Обновляем UI
    updateProgressBar(100);
    updateStatus('Завершено');
    collectionIsRunning = false;
    updateButtonStates();
    
    // Показываем уведомление
    showNotification('Сбор данных завершен!', 'success');
}

/**
 * Обрабатывает ошибку (упрощенная версия)
 */
function handleError(data) {
    const { error, message } = data;
    
    logToConsole(`❌ ${message}: ${error}`, 'error');
    updateStatus('Ошибка');
    collectionIsRunning = false;
    updateButtonStates();
    updateProgressBar(0);
    
    showNotification(`Ошибка: ${error}`, 'error');
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С UI ==========

/**
 * Логирует сообщение в консоль на странице
 */
function logToConsole(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    if (!logContent) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    const typeIcon = {
        'info': 'ℹ️',
        'error': '❌',
        'success': '✅',
        'warning': '⚠️',
        'progress': '📊'
    }[type] || '📝';
    
    logEntry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-icon">${typeIcon}</span>
        <span class="log-message">${message}</span>
    `;
    
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
}

/**
 * Обновляет индикатор прогресса
 */
function updateProgressBar(percentage) {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${Math.round(percentage)}%`;
    }
    
    const progressText = document.querySelector('.progress-text');
    if (progressText) {
        progressText.textContent = `Прогресс: ${Math.round(percentage)}%`;
    }
}

/**
 * Обновляет статус процесса
 */
function updateStatus(message) {
    const statusValue = document.getElementById('statusValue');
    if (statusValue) {
        statusValue.textContent = message;
        
        // Обновляем цвет в зависимости от статуса
        if (message.includes('Ошибка')) {
            statusValue.className = 'stat-value status-error';
        } else if (message.includes('Завершено')) {
            statusValue.className = 'stat-value status-success';
        } else if (message.includes('Запущен') || message.includes('Этап')) {
            statusValue.className = 'stat-value status-active';
        } else {
            statusValue.className = 'stat-value';
        }
    }
}

/**
 * Обновляет информацию о стадии
 */
function updateStageInfo(details) {
    const currentStage = document.getElementById('currentStage');
    if (currentStage && details.stage) {
        currentStage.textContent = details.stage;
    }
    
    const statsContainer = document.getElementById('statsContainer');
    if (statsContainer && details.processed !== undefined && details.total !== undefined) {
        statsContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Обработано:</span>
                <span class="stat-value">${details.processed}/${details.total}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Прогресс:</span>
                <span class="stat-value">${Math.round((details.processed / details.total) * 100)}%</span>
            </div>
        `;
    }
}

/**
 * Обновляет состояние кнопок
 */
function updateButtonStates() {
    const startBtn = document.getElementById('startBtn');
    const continueBtn = document.getElementById('continueBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (startBtn) startBtn.disabled = collectionIsRunning;
    if (continueBtn) continueBtn.disabled = collectionIsRunning;
    if (stopBtn) stopBtn.disabled = !collectionIsRunning;
}

/**
 * Обновляет информацию о коллекции
 */
async function updateCollectionInfo() {
    try {
        const status = await apiCall('/status');
        
        if (status.success) {
            const { isRunning, collectionInfo } = status.status;
            
            // Обновляем флаг состояния процесса
            collectionIsRunning = isRunning;
            updateButtonStates();
            
            // Обновляем только общую информацию
            const collectionTotal = document.getElementById('collectionTotal');
            const nftsInFile = document.getElementById('nftsInFile');
            
            if (collectionTotal) {
                collectionTotal.textContent = collectionInfo.totalInCollection || 0;
            }
            
            if (nftsInFile) {
                nftsInFile.textContent = collectionInfo.nftsInFile || 0;
            }
            
            // Обновляем статус
            updateStatus(isRunning ? 'Сбор выполняется...' : 
                        collectionInfo.lastUpdated ? 'Завершено' : 'Не активен');
        }
    } catch (error) {
        console.error('❌ Ошибка обновления информации о коллекции:', error);
    }
}

/**
 * Обновляет индикаторы этапов
 */
function updateStageIndicators(progress) {
    const indicators = document.querySelectorAll('.stage-indicator .indicator');
    
    indicators.forEach((indicator, index) => {
        const stageKey = `stage${index + 1}`;
        if (progress && progress[stageKey]) {
            const stageProgress = progress[stageKey];
            const percent = stageProgress.total > 0 ? 
                Math.round((stageProgress.completed / stageProgress.total) * 100) : 0;
            
            indicator.innerHTML = `
                <span class="indicator-label">Этап ${index + 1}</span>
                <span class="indicator-progress">${stageProgress.completed}/${stageProgress.total}</span>
                <div class="progress-bar-small">
                    <div class="progress-fill" style="width: ${percent}%"></div>
                </div>
            `;
            
            // Добавляем класс завершенности
            if (percent >= 100) {
                indicator.classList.add('completed');
            } else {
                indicator.classList.remove('completed');
            }
        }
    });
}

/**
 * Обновляет статус подключения
 */
function updateConnectionStatus(connected) {
    const connectionIndicator = document.querySelector('.connection-indicator');
    if (connectionIndicator) {
        if (connected) {
            connectionIndicator.innerHTML = '<span class="indicator-dot connected"></span> WebSocket подключен';
            connectionIndicator.className = 'connection-indicator connected';
        } else {
            connectionIndicator.innerHTML = '<span class="indicator-dot disconnected"></span> WebSocket отключен';
            connectionIndicator.className = 'connection-indicator disconnected';
        }
    }
}

/**
 * Показывает уведомление
 */
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    // Добавляем на страницу
    document.body.appendChild(notification);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// ========== ОСНОВНЫЕ ДЕЙСТВИЯ ==========

/**
 * Запускает сбор данных
 */
async function startCollection(startFromStage = null) {
    try {
        logToConsole('🚀 Запуск сбора данных...', 'info');
        updateStatus('Запуск...');
        collectionIsRunning = true;
        updateButtonStates();
        
        // Сбрасываем все этапы перед началом нового сбора
        resetAllStages();
        
        const data = startFromStage ? { startFromStage } : {};
        const result = await apiCall('/start', 'POST', data);
        
        if (result.success) {
            calculationId = result.calculationId;
            logToConsole(`✅ Сбор данных запущен (ID: ${calculationId})`, 'success');
            
            // Устанавливаем начальный этап
            if (startFromStage) {
                activateStage(startFromStage);
                updateStageProgress(startFromStage, 0, 'Начинается...', 'Подготовка к сбору');
            } else {
                activateStage(1);
                updateStageProgress(1, 0, 'Начинается...', 'Подготовка к сбору');
            }
            
            // Подписываемся на обновления через WebSocket
            if (isConnected) {
                subscribeToCalculation(calculationId);
            } else {
                logToConsole('⚠️ WebSocket не подключен, обновления прогресса недоступны', 'warning');
            }
            
            showNotification('Сбор данных запущен', 'success');
        }
    } catch (error) {
        logToConsole(`❌ Ошибка запуска сбора: ${error.message}`, 'error');
        collectionIsRunning = false;
        updateButtonStates();
        showNotification(`Ошибка запуска: ${error.message}`, 'error');
    }
}

/**
 * Останавливает сбор данных
 */
async function stopCollection() {
    try {
        // Проверяем, что процесс запущен
        if (!collectionIsRunning) {
            logToConsole('⚠️ Сбор данных не запущен, остановка невозможна', 'warning');
            showNotification('Сбор данных не запущен', 'warning');
            return;
        }
        
        logToConsole('⏹️ Остановка сбора данных...', 'warning');
        updateStatus('Остановка...');
        
        const result = await apiCall('/stop', 'POST');
        
        if (result.success) {
            logToConsole('✅ Сбор данных остановлен', 'success');
            updateStatus('Остановлен');
            collectionIsRunning = false;
            updateButtonStates();
            showNotification('Сбор данных остановлен', 'success');
        }
    } catch (error) {
        logToConsole(`❌ Ошибка остановки сбора: ${error.message}`, 'error');
        collectionIsRunning = false;
        updateButtonStates();
        showNotification(`Ошибка остановки: ${error.message}`, 'error');
    }
}

/**
 * Продолжает сбор данных
 */
async function continueCollection() {
    try {
        logToConsole('🔄 Продолжение сбора данных...', 'info');
        updateStatus('Продолжение...');
        collectionIsRunning = true;
        updateButtonStates();
        
        const result = await apiCall('/continue', 'POST');
        
        if (result.success) {
            calculationId = result.calculationId;
            logToConsole(`✅ Продолжение сбора запущено (ID: ${calculationId})`, 'success');
            
            if (isConnected) {
                subscribeToCalculation(calculationId);
            }
            
            showNotification('Продолжение сбора запущено', 'success');
        }
    } catch (error) {
        logToConsole(`❌ Ошибка продолжения сбора: ${error.message}`, 'error');
        collectionIsRunning = false;
        updateButtonStates();
        showNotification(`Ошибка продолжения: ${error.message}`, 'error');
    }
}



// ========== УПРАВЛЕНИЕ ПРОГРЕСС-БАРАМИ ЭТАПОВ ==========

/**
 * Сбрасывает все этапы в начальное состояние
 */
function resetAllStages() {
    for (let i = 1; i <= 3; i++) {
        updateStageProgress(i, 0, 'Ожидание', '-');
        document.getElementById(`stage${i}Container`).className = 'stage-container';
        document.getElementById(`stage${i}Status`).className = 'stage-status waiting';
    }
}

/**
 * Обновляет прогресс конкретного этапа
 */
function updateStageProgress(stageNumber, percentage, status, details) {
    const container = document.getElementById(`stage${stageNumber}Container`);
    const statusElement = document.getElementById(`stage${stageNumber}Status`);
    const progressBar = document.querySelector(`#stage${stageNumber}Progress .progress-fill-stage`);
    const progressText = document.getElementById(`stage${stageNumber}Text`);
    const detailsElement = document.getElementById(`stage${stageNumber}Details`);
    
    // Обновляем прогресс-бар
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }
    
    // Обновляем статус
    if (statusElement) {
        statusElement.textContent = status;
        
        // Обновляем классы статуса
        statusElement.className = 'stage-status';
        if (percentage >= 100) {
            statusElement.classList.add('completed');
        } else if (status.includes('Выполняется') || status.includes('Активен')) {
            statusElement.classList.add('active');
        } else if (status.includes('Ошибка')) {
            statusElement.classList.add('error');
        } else {
            statusElement.classList.add('waiting');
        }
    }
    
    // Обновляем детали
    if (detailsElement) {
        detailsElement.textContent = details;
    }
    
    // Обновляем контейнер
    if (container) {
        container.className = 'stage-container';
        if (percentage >= 100) {
            container.classList.add('completed');
        } else if (status.includes('Выполняется') || status.includes('Активен')) {
            container.classList.add('active');
        }
    }
}

/**
 * Активирует конкретный этап (делает его текущим)
 */
function activateStage(stageNumber) {
    // Деактивируем все этапы
    for (let i = 1; i <= 3; i++) {
        const container = document.getElementById(`stage${i}Container`);
        if (container) {
            container.classList.remove('active');
        }
    }
    
    // Активируем выбранный этап
    const container = document.getElementById(`stage${stageNumber}Container`);
    if (container) {
        container.classList.add('active');
    }
}

// ========== ОБНОВЛЕННАЯ ОБРАБОТКА WebSocket СООБЩЕНИЙ ==========

/**
 * Обрабатывает обновление прогресса с деталями этапов
 */
function handleProgressUpdate(data) {
    const { progress, message, details } = data;
    
    // Общий прогресс-бар
    updateProgressBar(progress);
    updateStatus(message);
    
    // Обновляем состояние процесса
    collectionIsRunning = data.status === 'in_progress';
    updateButtonStates();
    
    // Логируем важные обновления
    if (progress % 10 === 0 || progress >= 100) {
        logToConsole(`📊 Прогресс: ${progress}% - ${message}`, 'progress');
    }
    
    
}



/**
 * Обрабатывает завершение расчета
 */
function handleComplete(data) {
    const { result, message } = data;
    
    logToConsole(`✅ ${message}`, 'success');
    logToConsole(`📊 Результат: ${JSON.stringify(result, null, 2)}`, 'info');
    
    // Обновляем UI
    updateProgressBar(100);
    updateStatus('Завершено');
    collectionIsRunning = false;
    updateButtonStates();
    
    // Помечаем все этапы как завершенные
    for (let i = 1; i <= 3; i++) {
        updateStageProgress(i, 100, 'Завершено', 'Этап завершен');
    }
    
    // Обновляем информацию о коллекции
    updateCollectionInfo();
    
    // Показываем уведомление
    showNotification('Сбор данных завершен!', 'success');
}

/**
 * Обрабатывает ошибку
 */
function handleError(data) {
    const { error, message } = data;
    
    logToConsole(`❌ ${message}: ${error}`, 'error');
    updateStatus('Ошибка');
    collectionIsRunning = false;
    updateButtonStates();
    updateProgressBar(0);
    
    // Сбрасываем этапы при ошибке
    resetAllStages();
    
    showNotification(`Ошибка: ${error}`, 'error');
}




// ========== ИНИЦИАЛИЗАЦИЯ ==========

/**
 * Инициализация модуля
 */
async function initTribeInfoCollector() {
    console.log('🚀 Инициализация Tribe Info Collector...');
    
    // Очищаем старый calculationId при инициализации
    calculationId = null;
    collectionIsRunning = false;
    
    // Инициализация WebSocket
    initWebSocket();
    
    // Загрузка начального статуса (только один раз)
    try {
        await updateCollectionInfo();
    } catch (error) {
        console.error('❌ Ошибка получения статуса:', error);
    }
    
    // Обновляем состояние кнопок
    updateButtonStates();
    
    console.log('✅ Tribe Info Collector инициализирован');
}

/**
 * Очищает лог
 */
function clearLog() {
    const logContent = document.getElementById('logContent');
    if (logContent) {
        logContent.innerHTML = '';
        logToConsole('🧹 Лог очищен', 'info');
    }
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Основные кнопки
    const startBtn = document.getElementById('startBtn');
    const continueBtn = document.getElementById('continueBtn');
    const stopBtn = document.getElementById('stopBtn');   
    const clearLogBtn = document.getElementById('clearLogBtn');
  
    
    // Обработчики для основных кнопок
    if (startBtn) {
        startBtn.addEventListener('click', () => startCollection());
    }
    
    if (continueBtn) {
        continueBtn.addEventListener('click', continueCollection);
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopCollection);
    }   

    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', clearLog);
    }    
}

// ========== ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ==========

// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        initTribeInfoCollector();
    });
} else {
    setupEventListeners();
    initTribeInfoCollector();
}

// Экспортируем функции для использования в других скриптах
window.TribeInfoCollector = {
    startCollection,
    stopCollection,
    continueCollection,    
    updateCollectionInfo,   
    clearLog,
    logToConsole,
    showNotification
};

console.log('🎯 Tribe Info Collector готов к работе');