// public/assets/js/power.js - версия без WebSocket
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
let currentCalculationId = null;
let progressCheckInterval = null;

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
        currentCalculationId = null;
        
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
        
        currentCalculationId = response.calculationId;
        console.log(`📋 ID расчета: ${currentCalculationId}`);
        
        updateProgress(0, 'Запуск расчета...', `ID: ${currentCalculationId}`);
        
        // Начинаем проверять статус расчета
        startProgressPolling();
        
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

// Запуск polling для проверки прогресса
function startProgressPolling() {
    if (progressCheckInterval) {
        clearInterval(progressCheckInterval);
    }
    
    progressCheckInterval = setInterval(async () => {
        if (calculationAborted || !calculationInProgress || !currentCalculationId) {
            clearInterval(progressCheckInterval);
            return;
        }
        
        try {
            const status = await window.PowerAPI.getCalculationStatus(currentCalculationId);
            
            if (status.success) {
                updateProgress(
                    status.progress || 0,
                    status.message || 'В процессе...',
                    status.details || {}
                );
                
                // Если расчет завершен
                if (status.status === 'completed') {
                    finishCalculation(status);
                } else if (status.status === 'error') {
                    failCalculation(status);
                } else if (status.status === 'cancelled') {
                    abortCalculation(status);
                }
            }
        } catch (error) {
            console.warn('Ошибка проверки статуса:', error);
        }
    }, 1000); // Проверяем каждую секунду
}

// Завершение расчета
function finishCalculation(status) {
    clearInterval(progressCheckInterval);
    
    updateProgress(100, 'Расчет завершен!', status.details);
    
    setTimeout(() => {
        hideProgressModal();
        calculationInProgress = false;
        resetCalculateButton();
        
        showCalculationResults({
            success: true,
            ...status.details,
            processingTime: Date.now() - startTime
        });
        
        if (window.showNotification) {
            const processed = status.details?.totalProcessed || 0;
            window.showNotification(`Расчет завершен! Обработано ${processed} NFT`, 'success');
        }
    }, 1000);
}

// Ошибка расчета
function failCalculation(status) {
    clearInterval(progressCheckInterval);
    
    updateProgress(0, 'Ошибка расчета', status.details?.error || 'Неизвестная ошибка');
    
    setTimeout(() => {
        hideProgressModal();
        calculationInProgress = false;
        resetCalculateButton();
        
        showCalculationResults({
            error: true,
            message: status.details?.error || 'Ошибка расчета'
        });
    }, 2000);
}

// Отмена расчета
function abortCalculation(status) {
    clearInterval(progressCheckInterval);
    
    updateProgress(0, 'Расчет отменен', {});
    
    setTimeout(() => {
        hideProgressModal();
        calculationInProgress = false;
        resetCalculateButton();
        
        showCalculationResults({
            aborted: true,
            message: 'Расчет отменен пользователем'
        });
    }, 500);
}

// Отмена расчета
async function cancelCalculation() {
    if (calculationInProgress && currentCalculationId) {
        calculationAborted = true;
        
        updateProgress(0, 'Отмена расчета...');
        
        try {
            await window.PowerAPI.cancelCalculation(currentCalculationId);
        } catch (error) {
            console.warn('Ошибка отмены расчета:', error);
        }
    }
}

// Показ модального окна прогресса
function showProgressModal() {
    const modal = document.getElementById('progressModal');
    if (modal) {
        modal.style.display = 'flex';
        updateProgress(0, 'Подготовка к расчету...');
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
        if (details.processed !== undefined && details.total !== undefined) {
            const formattedProcessed = window.formatNumber ? 
                window.formatNumber(details.processed) : details.processed;
            const formattedTotal = window.formatNumber ? 
                window.formatNumber(details.total) : details.total;
            const progressPercent = details.total > 0 ? 
                Math.round((details.processed / details.total) * 100) : 0;
            
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-label">Обработано NFT:</span>
                    <span class="detail-value">${formattedProcessed} / ${formattedTotal} (${progressPercent}%)</span>
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
        
        // Добавляем ошибку
        if (details.error !== undefined) {
            detailsHTML += `
                <div class="detail-item error">
                    <span class="detail-label">Ошибка:</span>
                    <span class="detail-value">${details.error}</span>
                </div>
            `;
        }
        
        progressDetails.innerHTML = detailsHTML;
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
        // Показываем только основные результаты
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
                        
                        <div class="stat-row">
                            <div class="stat-label">Время выполнения:</div>
                            <div class="stat-value">${Math.round(result.processingTime / 1000)} сек</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    resultsContainer.innerHTML = resultsHTML;
}