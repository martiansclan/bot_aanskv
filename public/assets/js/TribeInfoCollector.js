
class TribeInfoCollectorUI {
    constructor() {
        this.apiBase = '/api/TribeInfoCollector';
        this.pollingInterval = null;
        this.currentCalculationId = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadStatus();
    }
    
    initializeElements() {
        // Кнопки
        this.startBtn = document.getElementById('start-collection');
        this.stopBtn = document.getElementById('stop-collection');
        this.checkIntegrityBtn = document.getElementById('check-integrity');
        
        // Элементы статуса
        this.totalInCollectionEl = document.getElementById('total-in-collection');
        this.nftsInFileEl = document.getElementById('nfts-in-file');
        this.lastUpdatedEl = document.getElementById('last-updated');
        
        // Прогресс
        this.progressBar = document.getElementById('collection-progress');
        this.progressText = document.getElementById('progress-text');
    }
    
    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCollection());
        this.stopBtn.addEventListener('click', () => this.stopCollection());
        this.checkIntegrityBtn.addEventListener('click', () => this.checkIntegrity());
    }
    
    async loadStatus() {
        try {
            const response = await fetch(`${this.apiBase}/status`);
            const data = await response.json();
            
            if (data.success) {
                this.updateStatus(data.status);
            }
        } catch (error) {
            console.error('Ошибка загрузки статуса:', error);
        }
    }
    
    updateStatus(status) {
        // Обновляем информацию
        this.totalInCollectionEl.textContent = this.formatNumber(status.collectionInfo.totalInCollection);
        
        if (status.collectionInfo.lastUpdated) {
            const date = new Date(status.collectionInfo.lastUpdated);
            this.lastUpdatedEl.textContent = date.toLocaleString('ru-RU');
        }
        
        // Остальной код без изменений...
        this.startBtn.disabled = status.isRunning;
        this.stopBtn.disabled = !status.isRunning;
        
        this.currentCalculationId = status.calculationId;
        
        if (status.isRunning && status.calculationId) {
            this.startProgressPolling(status.calculationId);
        } else {
            this.stopProgressPolling();
            this.updateProgress(0, 'Готов к запуску', 'ready');
        }
    }
    
    async startCollection() {
        try {
            this.showNotification('Запускаю сбор данных...', 'info');
            
            const response = await fetch(`${this.apiBase}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Сбор данных запущен', 'success');
                this.currentCalculationId = data.calculationId;
                this.startProgressPolling(data.calculationId);
            }
            
        } catch (error) {
            console.error('Ошибка запуска сбора:', error);
            this.showNotification('Ошибка запуска сбора', 'error');
        }
    }
    
    async stopCollection() {
        try {
            this.showNotification('Останавливаю сбор данных...', 'warning');
            
            const response = await fetch(`${this.apiBase}/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Сбор данных остановлен', 'info');
                this.stopProgressPolling();
                this.updateProgress(0, 'Остановлено пользователем', 'stopped');
            }
            
        } catch (error) {
            console.error('Ошибка остановки сбора:', error);
            this.showNotification('Ошибка остановки сбора', 'error');
        }
    }
    
    async checkIntegrity() {
        try {
            this.showNotification('Проверяю целостность данных...', 'info');
            
            const response = await fetch(`${this.apiBase}/check-integrity`);
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Проверка целостности завершена', 'success');
            } else {
                this.showNotification('Ошибка проверки целостности', 'error');
            }
            
            // Перезагружаем статус после проверки
            this.loadStatus();
            
        } catch (error) {
            console.error('Ошибка проверки целостности:', error);
            this.showNotification('Ошибка проверки целостности', 'error');
        }
    }
    
    startProgressPolling(calculationId) {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        // Первый запрос сразу
        this.checkProgress(calculationId);
        
        // Дальше опрашиваем каждые 3 секунды
        this.pollingInterval = setInterval(() => {
            this.checkProgress(calculationId);
        }, 3000);
    }
    
    stopProgressPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    
    async checkProgress(calculationId) {
        try {
            const response = await fetch(`${this.apiBase}/progress?calculationId=${calculationId}`);
            const data = await response.json();
            
            if (data.success) {
                this.updateProgressFromData(data.progress);
                
                // Если процесс завершен, останавливаем polling
                if (data.progress.status === 'completed' || 
                    data.progress.status === 'error' || 
                    data.progress.status === 'stopped') {
                    this.stopProgressPolling();
                    this.loadStatus(); // Обновляем общий статус
                }
            }
            
        } catch (error) {
            console.error('Ошибка проверки прогресса:', error);
        }
    }
    
    updateProgressFromData(progress) {
        const percent = progress.total > 0 ? 
            Math.round((progress.processed / progress.total) * 100) : 0;
        
        this.updateProgress(
            percent,
            progress.message,
            progress.status
        );
    }
    
    updateProgress(percent, text, status = 'in_progress') {
        // Обновляем прогресс бар
        this.progressBar.style.width = `${percent}%`;
        this.progressBar.textContent = `${percent}%`;
        
        // Устанавливаем класс статуса
        this.progressBar.className = 'progress-bar';
        if (status && status !== 'ready') {
            this.progressBar.classList.add(status);
        }
        
        // Обновляем текст
        this.progressText.textContent = text;
    }
    
    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notifications-container');
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Иконка в зависимости от типа
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';
        
        notification.innerHTML = `
            <span>${icon}</span>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Закрытие по клику
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });
        
        // Автоматическое закрытие
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
        
        container.appendChild(notification);
    }
    
    formatNumber(num) {
        return new Intl.NumberFormat('ru-RU').format(num);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new TribeInfoCollectorUI();
});
