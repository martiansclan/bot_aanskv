// public/assets/js/power-websocket.js
class PowerWebSocketClient {
    constructor() {
        this.ws = null;
        this.calculationId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.onProgressCallbacks = [];
        this.onCompleteCallbacks = [];
        this.onErrorCallbacks = [];
    }
    
    // Подключение к WebSocket
    connect(calculationId) {
        this.calculationId = calculationId;
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/power/ws?calculationId=${calculationId}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket подключен');
            this.reconnectAttempts = 0;
            
            // Подписываемся на обновления
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                calculationId
            }));
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Ошибка обработки WebSocket сообщения:', error);
            }
        };
        
        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket отключен:', event.code, event.reason);
            
            // Пытаемся переподключиться если не было нормального закрытия
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnect();
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'progress':
                this.onProgressCallbacks.forEach(callback => callback(data));
                this.updateUIProgress(data);
                break;
                
            case 'complete':
                this.onCompleteCallbacks.forEach(callback => callback(data));
                this.showCompleteUI(data);
                break;
                
            case 'error':
                this.onErrorCallbacks.forEach(callback => callback(data));
                this.showErrorUI(data);
                break;
                
            case 'pong':
                // Ответ на ping, ничего не делаем
                break;
        }
    }
    
    updateUIProgress(data) {
        const { progress, message, details } = data;
        
        // Обновляем прогресс бар
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressMessage = document.getElementById('progressMessage');
        const processedCount = document.getElementById('processedCount');
        const totalCount = document.getElementById('totalCount');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.style.transition = 'width 0.3s ease';
        }
        
        if (progressPercent) progressPercent.textContent = progress;
        if (progressMessage) progressMessage.textContent = message;
        
        if (details) {
            if (processedCount && details.processed) {
                processedCount.textContent = window.formatNumber ? 
                    window.formatNumber(details.processed) : details.processed;
            }
            
            if (totalCount && details.totalNFTs) {
                totalCount.textContent = window.formatNumber ? 
                    window.formatNumber(details.totalNFTs) : details.totalNFTs;
            }
            
            // Показываем дополнительную информацию
            this.updateDetailsUI(details);
        }
        
        // Анимированный текст для ожидания
        if (progress < 100) {
            this.showWaitingAnimation();
        }
    }
    
    updateDetailsUI(details) {
        const detailsEl = document.getElementById('progressDetails');
        if (!detailsEl) return;
        
        let html = '';
        
        if (details.processed && details.totalNFTs) {
            const percent = Math.round((details.processed / details.totalNFTs) * 100);
            html += `<div>📊 Прогресс: ${details.processed}/${details.totalNFTs} (${percent}%)</div>`;
        }
        
        if (details.updated !== undefined) {
            html += `<div>✅ NFT с Power: ${details.updated}</div>`;
        }
        
        if (details.withSynergy !== undefined) {
            html += `<div>⚡ NFT с синергиями: ${details.withSynergy}</div>`;
        }
        
        if (details.estimatedRemaining) {
            const minutes = Math.floor(details.estimatedRemaining / 60);
            const seconds = details.estimatedRemaining % 60;
            html += `<div>⏱️ Осталось: ${minutes > 0 ? `${minutes}м ` : ''}${seconds}с</div>`;
        }
        
        detailsEl.innerHTML = html;
    }
    
    showWaitingAnimation() {
        const messageEl = document.getElementById('progressMessage');
        if (!messageEl) return;
        
        // Простая анимация точек
        const text = messageEl.textContent;
        if (!text.includes('...')) {
            messageEl.textContent = text + '...';
        } else if (text.endsWith('...')) {
            messageEl.textContent = text;
        } else {
            messageEl.textContent = text + '.';
        }
    }
    
    showCompleteUI(data) {
        console.log('✅ Расчет завершен:', data);
        
        // Обновляем UI
        updateProgress(100, 100, 'Расчет завершен!');
        
        // Показываем результаты
        showCalculationResults(data.result || data.details);
        
        // Закрываем WebSocket
        this.disconnect();
        
        // Показываем уведомление
        if (window.showNotification) {
            const result = data.result || data.details;
            const message = `Расчет завершен! Обработано ${result.totalProcessed || 0} NFT`;
            window.showNotification(message, 'success');
        }
    }
    
    showErrorUI(data) {
        console.error('❌ Ошибка расчета:', data);
        
        updateProgress(0, 100, 'Ошибка расчета');
        
        if (window.showNotification) {
            window.showNotification(`Ошибка расчета: ${data.error || 'Неизвестная ошибка'}`, 'error');
        }
        
        this.disconnect();
    }
    
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Достигнут лимит переподключений');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        
        console.log(`🔄 Попытка переподключения ${this.reconnectAttempts} через ${delay}мс...`);
        
        setTimeout(() => {
            if (this.calculationId) {
                this.connect(this.calculationId);
            }
        }, delay);
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Calculation completed');
            this.ws = null;
        }
    }
    
    // Регистрация колбэков
    onProgress(callback) {
        this.onProgressCallbacks.push(callback);
    }
    
    onComplete(callback) {
        this.onCompleteCallbacks.push(callback);
    }
    
    onError(callback) {
        this.onErrorCallbacks.push(callback);
    }
    
    // Отмена расчета
    async cancelCalculation() {
        if (!this.calculationId) return;
        
        try {
            const response = await fetch(`/api/power/cancel/${this.calculationId}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('Расчет отменен');
                this.disconnect();
            }
        } catch (error) {
            console.error('Ошибка отмены расчета:', error);
        }
    }
}

// Глобальный объект для использования
window.PowerWebSocket = new PowerWebSocketClient();