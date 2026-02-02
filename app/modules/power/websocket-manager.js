// app/modules/power/websocket-manager.js
const WebSocket = require('ws');

class PowerWebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // calculationId -> Set of WebSockets
        this.calculationProgress = new Map(); // Храним прогресс расчетов
    }
    
    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/api/power/ws'
        });
        
        this.setupWebSocket();
        console.log('✅ WebSocket сервер Power запущен на /api/power/ws');
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('🔌 Новое WebSocket соединение');
            
            // Получаем calculationId из URL
            const url = new URL(req.url, `http://${req.headers.host}`);
            const calculationId = url.searchParams.get('calculationId');
            
            if (calculationId) {
                this.subscribeToCalculation(calculationId, ws);
            }
            
            ws.on('message', (message) => {
                this.handleMessage(ws, message);
            });
            
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket ошибка:', error);
            });
        });
    }
    
    subscribeToCalculation(calculationId, ws) {
        if (!this.clients.has(calculationId)) {
            this.clients.set(calculationId, new Set());
        }
        
        this.clients.get(calculationId).add(ws);
        
        // Отправляем текущий прогресс если есть
        if (this.calculationProgress.has(calculationId)) {
            const progress = this.calculationProgress.get(calculationId);
            this.sendToClient(ws, {
                type: 'progress',
                calculationId,
                ...progress
            });
        }
        
        console.log(`📡 Клиент подписался на расчет ${calculationId}`);
    }
    
    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
                case 'subscribe':
                    if (data.calculationId) {
                        this.subscribeToCalculation(data.calculationId, ws);
                    }
                    break;
                    
                case 'unsubscribe':
                    if (data.calculationId) {
                        this.unsubscribeFromCalculation(data.calculationId, ws);
                    }
                    break;
                    
                case 'ping':
                    this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
                    break;
            }
        } catch (error) {
            console.error('Ошибка обработки WebSocket сообщения:', error);
        }
    }
    
    handleDisconnect(ws) {
        // Удаляем клиента из всех подписок
        for (const [calculationId, clients] of this.clients.entries()) {
            if (clients.has(ws)) {
                clients.delete(ws);
                if (clients.size === 0) {
                    this.clients.delete(calculationId);
                }
            }
        }
        
        console.log('🔌 WebSocket соединение закрыто');
    }
    
    // Обновление прогресса расчета
    updateProgress(calculationId, progress, message, details = {}) {
        const progressData = {
            calculationId,
            progress: Math.min(100, Math.max(0, progress)),
            message,
            details,
            timestamp: Date.now(),
            status: progress >= 100 ? 'completed' : 'in_progress'
        };
        
        // Сохраняем прогресс
        this.calculationProgress.set(calculationId, progressData);
        
        // Отправляем всем подписчикам
        this.broadcastToCalculation(calculationId, {
            type: 'progress',
            ...progressData
        });
        
        // Логируем
        if (progress % 10 === 0 || progress >= 100) {
            console.log(`📡 [WS][${calculationId}] Прогресс: ${progress}% - ${message}`);
        }
    }
    
    // Завершение расчета
    completeCalculation(calculationId, result) {
        const progressData = {
            calculationId,
            progress: 100,
            message: 'Расчет завершен',
            details: result,
            timestamp: Date.now(),
            status: 'completed',
            result: result
        };
        
        this.calculationProgress.set(calculationId, progressData);
        
        this.broadcastToCalculation(calculationId, {
            type: 'complete',
            ...progressData
        });
        
        console.log(`✅ [WS][${calculationId}] Расчет завершен`);
    }
    
    // Ошибка расчета
    failCalculation(calculationId, error) {
        const progressData = {
            calculationId,
            progress: 0,
            message: 'Ошибка расчета',
            error: error.message,
            timestamp: Date.now(),
            status: 'error'
        };
        
        this.calculationProgress.set(calculationId, progressData);
        
        this.broadcastToCalculation(calculationId, {
            type: 'error',
            ...progressData
        });
        
        console.error(`❌ [WS][${calculationId}] Ошибка расчета:`, error);
    }
    
    broadcastToCalculation(calculationId, data) {
        const clients = this.clients.get(calculationId);
        if (clients) {
            const message = JSON.stringify(data);
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    }
    
    // Метод для отправки сообщения конкретному клиенту
    sendToClient(ws, data) {
        try {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(data));
            }
        } catch (error) {
            console.error('Ошибка отправки WebSocket сообщения:', error);
        }
    }
    
    unsubscribeFromCalculation(calculationId, ws) {
        const clients = this.clients.get(calculationId);
        if (clients) {
            clients.delete(ws);
            if (clients.size === 0) {
                this.clients.delete(calculationId);
            }
        }
    }
}

module.exports = new PowerWebSocketManager();