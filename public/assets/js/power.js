// public/assets/js/power.js - обновленная версия для вашего HTML
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== Power.js загружен ===');
    
    if (!window.PowerAPI) {
        console.error('❌ PowerAPI не найден!');
        if (window.showNotification) {
            window.showNotification('Ошибка: API не загружен', 'error');
        }
        return;
    }
    
    console.log('✅ PowerAPI доступен');
    
    // Проверяем WebSocket
    if (!window.PowerWebSocket) {
        console.warn('⚠️ WebSocket клиент не загружен');
    } else {
        console.log('✅ WebSocket клиент доступен');
    }
    
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    const calculateBtn = document.getElementById('calculatePowerBtn');    
    const cancelBtn = document.getElementById('cancelBtn');
    
    if (calculateBtn) {
        calculateBtn.addEventListener('click', startPowerCalculation);
    }       
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelCalculation);
    }
}

let calculationInProgress = false;
let calculationAborted = false;
let startTime = null;

// Начало расчета Power
async function startPowerCalculation() {
    if (calculationInProgress) {
        if (window.showNotification) {
            window.showNotification('Расчет уже выполняется', 'warning');
        }
        return;
    }
    
    if (!confirm('Начать расчет Power для всех NFT? Это может занять несколько минут.')) {
        return;
    }
    
    try {
        calculationInProgress = true;
        calculationAborted = false;
        startTime = Date.now();
        
        // Показываем модальное окно прогресса
        showProgressModal();
        
        // Обновляем кнопку
        const calculateBtn = document.getElementById('calculatePowerBtn');
        if (calculateBtn) {
            calculateBtn.disabled = true;
            calculateBtn.textContent = 'Расчет выполняется...';
        }
        
        console.log('🚀 Начинаем расчет Power...');
        
        // Запускаем расчет на сервере
        const response = await window.PowerAPI.calculatePower();
        
        if (!response.success) {
            throw new Error(response.error || 'Ошибка запуска расчета');
        }
        
        const { calculationId, wsEndpoint } = response;
        console.log(`📋 ID расчета: ${calculationId}`);
        console.log(`🔌 WebSocket endpoint: ${wsEndpoint}`);
        
        // Показываем ID расчета
        updateProgress(0, 'Запуск расчета...', `ID: ${calculationId}`);
        
        // Пробуем подключиться к WebSocket для реального прогресса
        if (window.PowerWebSocket) {
            setupWebSocketProgress(calculationId);
        } else {
            // Если WebSocket недоступен, показываем анимированный прогресс
            setupFallbackProgress(calculationId);
        }
        
    } catch (error) {
        console.error('❌ Ошибка запуска расчета:', error);
        calculationInProgress = false;
        resetCalculateButton();
        
        if (window.showNotification) {
            window.showNotification('Ошибка запуска расчета: ' + error.message, 'error');
        }
        
        showCalculationResults({
            error: true,
            message: error.message
        });
    }
}

// Настройка WebSocket для прогресса
function setupWebSocketProgress(calculationId) {
    window.PowerWebSocket.connect(calculationId);
    
    // Обновляем статус WebSocket
    updateWsStatus('Подключение...');
    
    window.PowerWebSocket.onProgress((data) => {
        updateProgress(data.progress, data.message, data.details);
        updateWsStatus('✅ Подключено');
    });
    
    window.PowerWebSocket.onComplete((data) => {
        updateProgress(100, 'Расчет завершен!', data.details);
        updateWsStatus('✅ Расчет завершен');
        
        // Показываем успешный результат
        setTimeout(() => {
            hideProgressModal();
            calculationInProgress = false;
            resetCalculateButton();
            
            showCalculationResults({
                success: true,
                ...data.result,
                processingTime: Date.now() - startTime
            });
            
            if (window.showNotification) {
                window.showNotification(`Расчет завершен! Обработано ${data.result.totalProcessed || 0} NFT`, 'success');
            }
        }, 1000);
    });
    
    window.PowerWebSocket.onError((data) => {
        updateProgress(0, 'Ошибка расчета', data.error);
        updateWsStatus('❌ Ошибка');
        
        setTimeout(() => {
            hideProgressModal();
            calculationInProgress = false;
            resetCalculateButton();
            
            showCalculationResults({
                error: true,
                message: data.error || 'Ошибка расчета'
            });
        }, 2000);
    });
}

// Fallback прогресс (если WebSocket недоступен)
function setupFallbackProgress(calculationId) {
    updateWsStatus('⚠️ Используется fallback режим');
    
    // Периодически проверяем статус через API
    let progress = 0;
    const checkInterval = setInterval(async () => {
        if (calculationAborted || !calculationInProgress) {
            clearInterval(checkInterval);
            return;
        }
        
        try {
            const status = await window.PowerAPI.getCalculationStatus(calculationId);
            
            if (status.success && status.progress) {
                const newProgress = status.progress.progress || 0;
                
                // Обновляем только если прогресс изменился
                if (newProgress > progress) {
                    progress = newProgress;
                    updateProgress(
                        progress,
                        status.progress.message || 'В процессе...',
                        status.progress.details
                    );
                }
                
                // Если расчет завершен
                if (status.progress.status === 'completed') {
                    clearInterval(checkInterval);
                    
                    updateProgress(100, 'Расчет завершен!', status.progress.details);
                    updateWsStatus('✅ Завершен через API');
                    
                    setTimeout(() => {
                        hideProgressModal();
                        calculationInProgress = false;
                        resetCalculateButton();
                        
                        showCalculationResults({
                            success: true,
                            ...status.progress.result,
                            processingTime: Date.now() - startTime
                        });
                    }, 1000);
                }
            }
        } catch (error) {
            console.warn('Ошибка проверки статуса:', error);
        }
    }, 2000); // Проверяем каждые 2 секунды
    
    // Анимируем прогресс между проверками
    let animatedProgress = 0;
    const animationInterval = setInterval(() => {
        if (calculationAborted || !calculationInProgress) {
            clearInterval(animationInterval);
            return;
        }
        
        // Плавно увеличиваем прогресс до достигнутого уровня
        if (animatedProgress < progress) {
            animatedProgress = Math.min(animatedProgress + 1, progress);
            
            // Обновляем только если нет WebSocket
            if (!window.PowerWebSocket) {
                const progressEl = document.getElementById('progressPercent');
                const fillEl = document.getElementById('progressFill');
                
                if (progressEl) progressEl.textContent = animatedProgress;
                if (fillEl) fillEl.style.width = `${animatedProgress}%`;
            }
        }
        
        // Если достигли 100%, останавливаем анимацию
        if (animatedProgress >= 100) {
            clearInterval(animationInterval);
        }
    }, 100);
}

// Отмена расчета
function cancelCalculation() {
    if (calculationInProgress) {
        calculationAborted = true;
        
        if (window.PowerWebSocket && window.PowerWebSocket.calculationId) {
            window.PowerWebSocket.cancelCalculation();
        }
        
        updateProgress(0, 'Расчет отменен...');
        updateWsStatus('⏹️ Отменяется...');
        
        setTimeout(() => {
            hideProgressModal();
            calculationInProgress = false;
            resetCalculateButton();
            
            showCalculationResults({
                aborted: true,
                message: 'Расчет отменен пользователем'
            });
            
            if (window.showNotification) {
                window.showNotification('Расчет отменен', 'info');
            }
        }, 500);
    }
}

// Показ модального окна прогресса
function showProgressModal() {
    const modal = document.getElementById('progressModal');
    if (modal) {
        modal.style.display = 'flex';
        updateProgress(0, 'Подготовка к расчету...');
        updateWsStatus('⏳ Инициализация...');
    }
}

// Скрытие модального окна прогресса
function hideProgressModal() {
    const modal = document.getElementById('progressModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Обновление прогресса в модальном окне
function updateProgress(percent, message, details = null) {
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressMessage = document.getElementById('progressMessage');
    const progressDetails = document.getElementById('progressDetails');
    
    // Обновляем прогресс бар
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
        progressFill.style.transition = 'width 0.3s ease';
    }
    
    if (progressPercent) {
        progressPercent.textContent = percent;
    }
    
    if (progressMessage) {
        progressMessage.textContent = message;
    }
    
    // Обновляем детали прогресса
    if (progressDetails && details) {
        let detailsHTML = '';
        
        // Добавляем обработанные NFT
        if (details.processed !== undefined && details.totalNFTs !== undefined) {
            const formattedProcessed = window.formatNumber ? 
                window.formatNumber(details.processed) : details.processed;
            const formattedTotal = window.formatNumber ? 
                window.formatNumber(details.totalNFTs) : details.totalNFTs;
            const progressPercent = details.totalNFTs > 0 ? 
                Math.round((details.processed / details.totalNFTs) * 100) : 0;
            
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-label">Обработано NFT:</span>
                    <span class="detail-value">${formattedProcessed} / ${formattedTotal} (${progressPercent}%)</span>
                </div>
            `;
        }
        
        // Добавляем NFT с Power
        if (details.updated !== undefined) {
            const formatted = window.formatNumber ? 
                window.formatNumber(details.updated) : details.updated;
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-label">NFT с Power:</span>
                    <span class="detail-value">${formatted}</span>
                </div>
            `;
        }
        
        // Добавляем NFT с синергиями
        if (details.withSynergy !== undefined) {
            const formatted = window.formatNumber ? 
                window.formatNumber(details.withSynergy) : details.withSynergy;
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-label">NFT с синергиями:</span>
                    <span class="detail-value">${formatted}</span>
                </div>
            `;
        }
        
        // Добавляем скорость обработки
        if (details.speed !== undefined) {
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-label">Скорость:</span>
                    <span class="detail-value">${details.speed} NFT/сек</span>
                </div>
            `;
        }
        
        // Добавляем оставшееся время
        if (details.estimatedRemaining !== undefined) {
            const minutes = Math.floor(details.estimatedRemaining / 60);
            const seconds = details.estimatedRemaining % 60;
            const timeStr = minutes > 0 ? `${minutes}м ${seconds}с` : `${seconds}с`;
            
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-label">Осталось:</span>
                    <span class="detail-value">${timeStr}</span>
                </div>
            `;
        }
        
        progressDetails.innerHTML = detailsHTML;
    }
}

// Обновление статуса WebSocket
function updateWsStatus(status) {
    const wsStatus = document.getElementById('wsStatus');
    if (wsStatus) {
        wsStatus.innerHTML = `<small>📡 ${status}</small>`;
    }
}

// Восстановление кнопки расчета
function resetCalculateButton() {
    const calculateBtn = document.getElementById('calculatePowerBtn');
    if (calculateBtn) {
        calculateBtn.disabled = false;
        calculateBtn.textContent = '🔢 Расчет Power по атрибутам';
    }
}

// Показ результатов расчета
function showCalculationResults(result) {
    const resultsContainer = document.getElementById('calculationResults');
    
    if (!resultsContainer) return;
    
    const formatNum = window.formatNumber || ((num) => num.toString());
    
    let resultsHTML = '';
    
    if (result.error) {
        // Показываем ошибку
        resultsHTML = `
            <div class="result-item error">
                <h4>❌ Ошибка расчета</h4>
                <div class="result-content">
                    <p>${result.message || 'Произошла ошибка при расчете'}</p>
                </div>
            </div>
        `;
    } else if (result.aborted) {
        // Показываем отмену
        resultsHTML = `
            <div class="result-item warning">
                <h4>⏹️ Расчет отменен</h4>
                <div class="result-content">
                    <p>Расчет был отменен пользователем</p>
                </div>
            </div>
        `;
    } else if (result.success) {
        // Показываем только основные результаты БЕЗ дополнительной информации
        const synergyPercent = result.totalProcessed > 0 ? 
            Math.round((result.nftsWithSynergy / result.totalProcessed) * 100) : 0;
        
        resultsHTML = `
            <div class="result-item success">
                <h4>✅ Расчет Power завершен</h4>
                <div class="result-content">
                    <div class="result-stats">
                        <div class="stat-row">
                            <div class="stat-label">Обработано NFT:</div>
                            <div class="stat-value">${formatNum(result.totalProcessed || 0)}</div>
                        </div>
                       
                        <div class="stat-row">
                            <div class="stat-label">NFT с синергиями:</div>
                            <div class="stat-value">${formatNum(result.nftsWithSynergy || 0)}</div>
                        </div>
                        
                        <div class="stat-row">
                            <div class="stat-label">Процент с синергиями:</div>
                            <div class="stat-value">${synergyPercent}%</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Общий результат
        resultsHTML = `
            <div class="result-item">
                <h4>Расчет выполнен</h4>
                <div class="result-content">
                    <div class="result-stats">
                        <div class="stat-item">
                            <span class="stat-label">Обработано NFT:</span>
                            <span class="stat-value">${formatNum(result.totalProcessed || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">NFT с Power:</span>
                            <span class="stat-value">${formatNum(result.totalUpdated || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">NFT с синергиями:</span>
                            <span class="stat-value">${formatNum(result.nftsWithSynergy || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    resultsContainer.innerHTML = resultsHTML;
}

// Вспомогательные функции

/*
function downloadResults() {
    window.location.href = '/api/power/export-power-only';
}
*/
