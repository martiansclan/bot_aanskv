// Вспомогательные функции

// Форматирование чисел
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

// Обрезка текста с многоточием
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Создание модального окна
function createModal(content, options = {}) {
    const {
        onClose = null,
        closeOnClickOutside = true,
        className = '',
    } = options;

    const modal = document.createElement('div');
    modal.className = `modal-overlay ${className}`;
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.innerHTML = content;
    
    // Кнопка закрытия
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
        modal.remove();
        if (onClose) onClose();
    };
    
    modalContent.prepend(closeBtn);
    modal.appendChild(modalContent);
    
    // Закрытие по клику вне контента
    if (closeOnClickOutside) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
                if (onClose) onClose();
            }
        };
    }
    
    document.body.appendChild(modal);
    
    return {
        element: modal,
        close: () => {
            modal.remove();
            if (onClose) onClose();
        },
    };
}

// Отображение уведомления
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1001;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, duration);
    
    return notification;
}

// Состояние загрузки
function setLoadingState(element, isLoading) {
    if (isLoading) {
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.style.cssText = `
            width: 20px;
            height: 20px;
            margin: 0 auto;
        `;
        element.dataset.originalContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(spinner);
        element.disabled = true;
    } else {
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }
        element.disabled = false;
    }
}

// Экспортируем функции
window.formatNumber = formatNumber;
window.truncateText = truncateText;
window.formatDate = formatDate;
window.createModal = createModal;
window.showNotification = showNotification;
window.setLoadingState = setLoadingState;