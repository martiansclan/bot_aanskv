// TribeInfoCollector.js - фронтенд для модуля TribeInfoCollector (без WebSocket)

class TribeInfoCollectorFrontend {
    constructor() {
        this.moduleName = 'TribeInfoCollector';
        this.baseUrl = '/api/TribeInfoCollector';
        this.currentCalculationId = null;
        this.pollingInterval = null;
        this.pollingDelay = 1000; // 1 секунда
        this.maxPollingAttempts = 300; // 5 минут при опросе раз в секунду
        this.currentPollingAttempt = 0;
        this.isCollecting = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadModuleInfo();
        this.loadCollectionStatus();
    }
    
    initializeElements() {
        // Основные элементы
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.continueBtn = document.getElementById('continueBtn');
        this.createSummaryBtn = document.getElementById('createSummaryBtn');
        this.refreshCollectionInfoBtn = document.getElementById('refreshCollectionInfo');
        this.clearLogBtn = document.getElementById('clearLogBtn');
        
        // Статус и прогресс
        this.statusValue = document.getElementById('statusValue');
        this.collectionTotal = document.getElementById('collectionTotal');
        this.nftsInFile = document.getElementById('nftsInFile');
        this.currentStage = document.getElementById('currentStage');
        
        // Прогресс этапов
        this.stage1Progress = document.getElementById('stage1Progress');
        this.stage1Text = document.getElementById('stage1Text');
        this.stage1Status = document.getElementById('stage1Status');
        this.stage1Details = document.getElementById('stage1Details');
        
        this.stage2Progress = document.getElementById('stage2Progress');
        this.stage2Text = document.getElementById('stage2Text');
        this.stage2Status = document.getElementById('stage2Status');
        this.stage2Details = document.getElementById('stage2Details');
        
        this.stage3Progress = document.getElementById('stage3Progress');
        this.stage3Text = document.getElementById('stage3Text');
        this.stage3Status = document.getElementById('stage3Status');
        this.stage3Details = document.getElementById('stage3Details');
        
        // Лог
        this.logContent = document.getElementById('logContent');
        
        // Информация о модуле
        this.moduleVersion = document.getElementById('moduleVersion');
        this.moduleStatus = document.getElementById('moduleStatus');
        this.lastUpdated = document.getElementById('lastUpdated');
        this.wsStatus = document.getElementById('wsStatus');
    }
    
    bindEvents() {
        // Основные кнопки
        this.startBtn?.addEventListener('click', () => this.startCollection());
        this.stopBtn?.addEventListener('click', () => this.stopCollection());
        this.continueBtn?.addEventListener('click', () => this.continueCollection());
        this.createSummaryBtn?.addEventListener('click', () => this.createSummary());
        this.refreshCollectionInfoBtn?.addEventListener('click', () => this.loadCollectionInfo());
        this.clearLogBtn?.addEventListener('click', () => this.clearLog());
        
        // Кнопки этапов
        const stageButtons = document.querySelectorAll('.stage-btn-1, .stage-btn-2, .stage-btn-3');
        stageButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stageNum = e.target.classList.contains('stage-btn-1') ? 1 :
                                e.target.classList.contains('stage-btn-2') ? 2 : 3;
                this.startSpecificStage(stageNum);
            });
        });
        
        // Автообновление информации каждые 30 секунд
        setInterval(() => {
            if (!this.isCollecting) {
                this.loadModuleInfo();
                this.loadCollectionStatus();
            }
        }, 30000);
    }
    
    // ========== API МЕТОДЫ ==========
    
    async apiRequest(endpoint, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            this.logToConsole(`📡 Отправка запроса: ${endpoint}`, 'info');
            const response = await fetch(`${this.baseUrl}${endpoint}`, finalOptions);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            this.logToConsole(`📡 Ответ получен: ${endpoint}`, 'success');
            return data;
            
        } catch (error) {
            console.error(`❌ API ошибка ${endpoint}:`, error);
            this.logToConsole(`❌ Ошибка: ${error.message}`, 'error');
            this.showNotification(`Ошибка: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // ========== ОСНОВНЫЕ ФУНКЦИИ ==========
    
    async loadModuleInfo() {
        try {
            const data = await this.apiRequest('/module-info');
            
            if (data.success) {
                this.updateModuleInfo(data);
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки информации модуля:', error);
        }
    }
    
    async loadCollectionStatus() {
        try {
            const data = await this.apiRequest('/status');
            
            if (data.success) {
                this.updateStatus(data.status);
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статуса:', error);
        }
    }
    
    async loadCollectionInfo() {
        try {
            this.logToConsole('Загрузка информации о коллекции...', 'info');
            const data = await this.apiRequest('/collection-info');
            
            if (data.success) {
                this.collectionTotal.textContent = data.totalNfts || 0;
                this.logToConsole(`Информация о коллекции: ${data.totalNfts} NFT`, 'success');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки информации коллекции:', error);
        }
    }
    
    async startCollection() {
        try {
            this.logToConsole('Запуск сбора данных...', 'info');
            
            const response = await this.apiRequest('/start', {
                method: 'POST',
                body: JSON.stringify({ startFromStage: 1 })
            });
            
            if (response.success) {
                this.currentCalculationId = response.calculationId;
                this.logToConsole(`✅ Сбор данных запущен (ID: ${response.calculationId})`, 'success');
                this.showNotification(`Сбор данных запущен (ID: ${response.calculationId})`, 'success');
                
                // Обновляем UI
                this.isCollecting = true;
                this.updateButtons(true);
                this.statusValue.textContent = 'Активен';
                this.statusValue.className = 'stat-value status-active';
                
                // Запускаем polling
                this.startPolling(response.calculationId);
                
                // Обновляем информацию
                setTimeout(() => {
                    this.loadCollectionStatus();
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ Ошибка запуска сбора:', error);
            this.showNotification(`❌ Ошибка: ${error.message}`, 'error');
        }
    }
    
    async stopCollection() {
        try {
            this.logToConsole('Остановка сбора данных...', 'warning');
            
            const response = await this.apiRequest('/stop', {
                method: 'POST'
            });
            
            if (response.success) {
                this.logToConsole(`🛑 Сбор данных остановлен`, 'warning');
                this.showNotification('Сбор данных остановлен', 'warning');
                
                // Обновляем UI
                this.isCollecting = false;
                this.updateButtons(false);
                this.statusValue.textContent = 'Остановлен';
                this.statusValue.className = 'stat-value status-stopped';
                
                // Останавливаем polling
                this.stopPolling();
                
                // Обновляем информацию
                setTimeout(() => {
                    this.loadCollectionStatus();
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ Ошибка остановки сбора:', error);
            this.showNotification(`❌ Ошибка: ${error.message}`, 'error');
        }
    }
    
    async continueCollection() {
        try {
            this.logToConsole('Продолжение сбора данных...', 'info');
            
            const response = await this.apiRequest('/continue', {
                method: 'POST',
                body: JSON.stringify({ calculationId: this.currentCalculationId })
            });
            
            if (response.success) {
                this.currentCalculationId = response.calculationId;
                this.logToConsole(`🔄 Продолжение сбора (новый ID: ${response.calculationId})`, 'success');
                this.showNotification('Продолжение сбора данных', 'info');
                
                // Обновляем UI
                this.isCollecting = true;
                this.updateButtons(true);
                this.statusValue.textContent = 'Активен';
                this.statusValue.className = 'stat-value status-active';
                
                // Запускаем polling
                this.startPolling(response.calculationId);
            }
            
        } catch (error) {
            console.error('❌ Ошибка продолжения сбора:', error);
            this.showNotification(`❌ Ошибка: ${error.message}`, 'error');
        }
    }
    
    async createSummary() {
        try {
            this.logToConsole('Создание сводного файла...', 'info');
            this.showNotification('Создание сводного файла...', 'info');
            
            const response = await this.apiRequest('/create-summary', {
                method: 'POST'
            });
            
            if (response.success) {
                this.logToConsole(`✅ ${response.message}`, 'success');
                this.showNotification(response.message, 'success');
                
                // Обновляем информацию о файлах
                setTimeout(() => {
                    this.loadModuleInfo();
                }, 1000);
            } else {
                this.logToConsole(`❌ ${response.error}`, 'error');
                this.showNotification(response.error, 'error');
            }
            
        } catch (error) {
            console.error('❌ Ошибка создания сводного файла:', error);
            this.showNotification(`❌ Ошибка: ${error.message}`, 'error');
        }
    }
    
    async startSpecificStage(stageNumber) {
        try {
            this.logToConsole(`Запуск сбора с этапа ${stageNumber}...`, 'info');
            
            const response = await this.apiRequest('/start', {
                method: 'POST',
                body: JSON.stringify({ startFromStage: stageNumber })
            });
            
            if (response.success) {
                this.currentCalculationId = response.calculationId;
                this.logToConsole(`✅ Сбор с этапа ${stageNumber} запущен`, 'success');
                this.showNotification(`Сбор с этапа ${stageNumber} запущен`, 'success');
                
                // Обновляем UI
                this.isCollecting = true;
                this.updateButtons(true);
                this.statusValue.textContent = 'Активен';
                this.statusValue.className = 'stat-value status-active';
                
                // Запускаем polling
                this.startPolling(response.calculationId);
            }
            
        } catch (error) {
            console.error('❌ Ошибка запуска этапа:', error);
            this.showNotification(`❌ Ошибка: ${error.message}`, 'error');
        }
    }
    
    // ========== POLLING МЕХАНИЗМ ==========
    
    startPolling(calculationId) {
        // Останавливаем предыдущий polling
        this.stopPolling();
        
        this.currentCalculationId = calculationId;
        this.currentPollingAttempt = 0;
        
        // Начинаем polling
        this.pollingInterval = setInterval(async () => {
            await this.pollProgress(calculationId);
        }, this.pollingDelay);
        
        // Первый запрос сразу
        setTimeout(() => this.pollProgress(calculationId), 100);
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        this.currentPollingAttempt = 0;
    }
    
    async pollProgress(calculationId) {
        if (this.currentPollingAttempt >= this.maxPollingAttempts) {
            this.logToConsole('⚠️ Достигнут лимит опросов прогресса', 'warning');
            this.stopPolling();
            this.isCollecting = false;
            this.updateButtons(false);
            return;
        }
        
        this.currentPollingAttempt++;
        
        try {
            const data = await this.apiRequest(`/progress?calculationId=${calculationId}`);
            
            if (data.success && data.progress) {
                this.updateProgress(data.progress);
                
                // Если расчет завершен, останавливаем polling
                if (data.progress.status === 'completed' || 
                    data.progress.status === 'error' || 
                    data.progress.status === 'not_found') {
                    
                    this.stopPolling();
                    this.isCollecting = false;
                    this.updateButtons(false);
                    
                    if (data.progress.status === 'completed') {
                        this.logToConsole('🎉 Сбор данных завершен!', 'success');
                        this.showNotification('Сбор данных завершен!', 'success');
                        this.statusValue.textContent = 'Завершен';
                        this.statusValue.className = 'stat-value status-completed';
                        
                        // Обновляем информацию
                        setTimeout(() => {
                            this.loadModuleInfo();
                            this.loadCollectionStatus();
                        }, 1000);
                    } else if (data.progress.status === 'error') {
                        this.logToConsole(`❌ Ошибка: ${data.progress.message}`, 'error');
                        this.statusValue.textContent = 'Ошибка';
                        this.statusValue.className = 'stat-value status-error';
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка polling:', error);
            
            // Если много ошибок подряд, останавливаем polling
            if (this.currentPollingAttempt > 10) {
                this.logToConsole('⚠️ Прервано из-за ошибок соединения', 'warning');
                this.stopPolling();
                this.isCollecting = false;
                this.updateButtons(false);
            }
        }
    }
    
    // ========== ОБНОВЛЕНИЕ UI ==========
    
    updateModuleInfo(data) {
        if (this.moduleVersion) this.moduleVersion.textContent = data.version;
        if (this.moduleStatus) {
            this.moduleStatus.textContent = data.enabled ? 'Активен' : 'Отключен';
            this.moduleStatus.className = `info-value ${data.enabled ? 'status-active' : 'status-stopped'}`;
        }
        if (this.lastUpdated) {
            this.lastUpdated.textContent = new Date(data.serverTime).toLocaleString('ru-RU');
        }
        if (this.wsStatus) {
            this.wsStatus.textContent = 'Не используется';
            this.wsStatus.className = 'info-value status-stopped';
        }
    }
    
    updateStatus(status) {
        // Статус сбора
        if (this.statusValue) {
            if (status.isRunning) {
                this.statusValue.textContent = 'Активен';
                this.statusValue.className = 'stat-value status-active';
            } else {
                this.statusValue.textContent = 'Не активен';
                this.statusValue.className = 'stat-value status-stopped';
            }
        }
        
        // Статистика коллекции
        if (this.collectionTotal) {
            this.collectionTotal.textContent = status.collectionInfo.totalInCollection || 0;
        }
        
        if (this.nftsInFile) {
            this.nftsInFile.textContent = status.collectionInfo.nftsInFile || 0;
        }
        
        if (this.currentStage) {
            const stageNames = {
                0: 'Не начат',
                1: 'Этап 1',
                2: 'Этап 2',
                3: 'Этап 3',
                4: 'Завершено'
            };
            this.currentStage.textContent = stageNames[status.currentStage] || '-';
        }
        
        // Обновляем прогресс этапов
        this.updateStageProgress(
            1, 
            status.progress.stage1.completed, 
            status.progress.stage1.total,
            status.currentStage === 1 && status.isRunning ? 'В процессе' : 'Ожидание'
        );
        
        this.updateStageProgress(
            2, 
            status.progress.stage2.completed, 
            status.progress.stage2.total,
            status.currentStage === 2 && status.isRunning ? 'В процессе' : 'Ожидание'
        );
        
        this.updateStageProgress(
            3, 
            status.progress.stage3.completed, 
            status.progress.stage3.total,
            status.currentStage === 3 && status.isRunning ? 'В процессе' : 'Ожидание'
        );
    }
    
    updateProgress(progress) {
        // Обновляем текущий этап
        const stage = progress.stage || 1;
        const processed = progress.processed || 0;
        const total = progress.total || 100;
        const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
        const message = progress.message || 'В процессе...';
        
        // Обновляем активный этап
        const stageNames = {
            1: 'Этап 1: Базовая информация',
            2: 'Этап 2: Детали NFT',
            3: 'Этап 3: Генерация ссылок',
            4: 'Завершено'
        };
        
        if (this.currentStage) {
            this.currentStage.textContent = stageNames[stage] || `Этап ${stage}`;
        }
        
        // Обновляем прогресс для текущего этапа
        this.updateStageProgress(
            stage,
            processed,
            total,
            message,
            true // isActive
        );
        
        // Если есть детали по всем этапам
        if (progress.details && progress.details.stage1) {
            this.updateStageProgress(
                1,
                progress.details.stage1.completed || 0,
                progress.details.stage1.total || 100,
                progress.details.stage1.completed === progress.details.stage1.total ? 'Завершен' : 'Ожидание'
            );
            
            this.updateStageProgress(
                2,
                progress.details.stage2.completed || 0,
                progress.details.stage2.total || 100,
                progress.details.stage2.completed === progress.details.stage2.total ? 'Завершен' : 'Ожидание'
            );
            
            this.updateStageProgress(
                3,
                progress.details.stage3.completed || 0,
                progress.details.stage3.total || 100,
                progress.details.stage3.completed === progress.details.stage3.total ? 'Завершен' : 'Ожидание'
            );
        }
    }
    
    updateStageProgress(stageNumber, completed, total, statusText, isActive = false) {
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        let stageElement, textElement, statusElement, detailsElement;
        
        switch(stageNumber) {
            case 1:
                stageElement = this.stage1Progress?.querySelector('.progress-fill-stage');
                textElement = this.stage1Text;
                statusElement = this.stage1Status;
                detailsElement = this.stage1Details;
                break;
            case 2:
                stageElement = this.stage2Progress?.querySelector('.progress-fill-stage');
                textElement = this.stage2Text;
                statusElement = this.stage2Status;
                detailsElement = this.stage2Details;
                break;
            case 3:
                stageElement = this.stage3Progress?.querySelector('.progress-fill-stage');
                textElement = this.stage3Text;
                statusElement = this.stage3Status;
                detailsElement = this.stage3Details;
                break;
        }
        
        if (stageElement) {
            stageElement.style.width = `${percent}%`;
            
            // Цвет в зависимости от статуса
            if (isActive) {
                stageElement.style.backgroundColor = '#007bff'; // синий для активного
            } else if (percent === 100) {
                stageElement.style.backgroundColor = '#28a745'; // зеленый для завершенного
            } else {
                stageElement.style.backgroundColor = '#6c757d'; // серый для ожидания
            }
        }
        
        if (textElement) {
            textElement.textContent = `${percent}% (${completed}/${total})`;
        }
        
        if (statusElement) {
            statusElement.textContent = statusText;
            statusElement.className = `stage-status ${
                isActive ? 'status-active' : 
                percent === 100 ? 'status-completed' : 'status-pending'
            }`;
        }
        
        if (detailsElement) {
            detailsElement.textContent = isActive ? `Обработано: ${completed} из ${total} NFT` : '-';
        }
    }
    
    updateButtons(isRunning) {
        if (this.startBtn) {
            this.startBtn.disabled = isRunning;
            this.startBtn.style.opacity = isRunning ? '0.6' : '1';
        }
        
        if (this.stopBtn) {
            this.stopBtn.disabled = !isRunning;
            this.stopBtn.style.opacity = isRunning ? '1' : '0.6';
        }
        
        if (this.continueBtn) {
            this.continueBtn.disabled = isRunning;
            this.continueBtn.style.opacity = isRunning ? '0.6' : '1';
        }
    }
    
    // ========== ЛОГИРОВАНИЕ ==========
    
    logToConsole(message, type = 'info') {
        if (!this.logContent) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        
        const time = new Date().toLocaleTimeString('ru-RU');
        const icons = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };
        
        logEntry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-icon">${icons[type] || '📝'}</span>
            <span class="log-message">${message}</span>
        `;
        
        this.logContent.prepend(logEntry);
        
        // Ограничиваем количество записей в логе
        const maxEntries = 100;
        const entries = this.logContent.querySelectorAll('.log-entry');
        if (entries.length > maxEntries) {
            for (let i = maxEntries; i < entries.length; i++) {
                entries[i].remove();
            }
        }
        
        // Автопрокрутка к новой записи
        this.logContent.scrollTop = 0;
    }
    
    clearLog() {
        if (this.logContent) {
            this.logContent.innerHTML = '';
            this.logToConsole('Лог очищен', 'info');
        }
    }
    
    // ========== УВЕДОМЛЕНИЯ ==========
    
    showNotification(message, type = 'info') {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            font-weight: bold;
            animation: slideIn 0.3s ease-out;
        `;
        
        const colors = {
            'success': '#28a745',
            'error': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8'
        };
        
        notification.style.backgroundColor = colors[type] || '#17a2b8';
        
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
        
        // Добавляем CSS для анимации
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 Инициализация Tribe Info Collector...');
    window.tribeCollector = new TribeInfoCollectorFrontend();
});