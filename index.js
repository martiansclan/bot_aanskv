// index.js - главный файл для Render
const express = require('express');
const { API_TOKEN } = require('./modules/utils.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== HTTP ЭНДПОИНТЫ ====================

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🤖 Martian Clan Bot</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 800px;
          width: 100%;
          text-align: center;
        }
        
        h1 {
          color: #333;
          margin-bottom: 20px;
          font-size: 2.5em;
        }
        
        .status {
          background: #4CAF50;
          color: white;
          padding: 15px 30px;
          border-radius: 50px;
          display: inline-block;
          margin: 20px 0;
          font-size: 1.2em;
          font-weight: bold;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        
        .info-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          border-left: 5px solid #667eea;
        }
        
        .info-card h3 {
          color: #667eea;
          margin-bottom: 10px;
        }
        
        .links {
          margin-top: 30px;
        }
        
        .links a {
          display: inline-block;
          margin: 0 10px;
          padding: 12px 25px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          transition: all 0.3s;
        }
        
        .links a:hover {
          background: #764ba2;
          transform: translateY(-2px);
        }
        
        .footer {
          margin-top: 30px;
          color: #666;
          font-size: 0.9em;
        }
        
        @media (max-width: 600px) {
          .container {
            padding: 20px;
          }
          
          h1 {
            font-size: 2em;
          }
          
          .links a {
            display: block;
            margin: 10px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 Martian Clan NFT Bot</h1>
        <div class="status">✅ Система активна и работает</div>
        
        <div class="info-grid">
          <div class="info-card">
            <h3>🕒 Время сервера</h3>
            <p>${new Date().toLocaleString('ru-RU')}</p>
          </div>
          
          <div class="info-card">
            <h3>📡 Порт</h3>
            <p>${PORT}</p>
          </div>
          
          <div class="info-card">
            <h3>⏱️ Аптайм</h3>
            <p>${Math.floor(process.uptime() / 3600)}ч ${Math.floor((process.uptime() % 3600) / 60)}м</p>
          </div>
          
          <div class="info-card">
            <h3>🚀 Режим</h3>
            <p>Telegram Polling</p>
          </div>
        </div>
        
        <div class="links">
          <a href="/health">Health Check</a>
          <a href="/status">Bot Status</a>
          <a href="/commands">Доступные команды</a>
        </div>
        
        <div class="footer">
          <p>Система развернута на Render • Martian Clan Community</p>
          <p>Telegram: @martianclan_bot</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check (обязательно для Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'martian-nft-bot',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Статус бота
app.get('/status', (req, res) => {
  res.json({
    bot: {
      status: 'running',
      polling: true,
      started: new Date(Date.now() - process.uptime() * 1000).toISOString()
    },
    endpoints: {
      health: '/health',
      status: '/status',
      commands: '/commands',
      home: '/'
    },
    environment: {
      port: PORT,
      node_env: process.env.NODE_ENV || 'production',
      render: process.env.RENDER ? true : false
    }
  });
});

// Список команд
app.get('/commands', (req, res) => {
  res.json({
    commands: [
      '/start - Начало работы',
      '/help - Справка по командам',
      '/start_collect - Начать сбор NFT',
      '/stop_collect - Остановить сбор',
      '/collect_status - Статус сбора',
      '/DBstats - Статистика базы',
      '/createCards - Создать карточки',
      '/show_cards - Показать карточки',
      '/synergy_sort - Сортировка по синергии',
      '/create_synergy_map - Создать карту синергий',
      '/synergy_stats - Статистика синергий'
    ]
  });
});

// 404 обработчик
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.path} not found`,
    available_routes: ['/', '/health', '/status', '/commands']
  });
});

// ==================== ЗАПУСК СЕРВЕРА ====================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
==========================================
🚀 Martian NFT Bot Server запущен!
🌐 Порт: ${PORT}
📡 Доступен по: http://0.0.0.0:${PORT}
🕒 Время запуска: ${new Date().toLocaleString()}
==========================================
  `);
});

// ==================== ЗАПУСК TELEGRAM БОТА ====================

console.log('🤖 Запуск Telegram бота...');

// Импортируем и запускаем основной файл бота
require('./bot_aanskv.js');

console.log('✅ Telegram бот инициализирован!');

// ==================== ОБРАБОТКА ВЫКЛЮЧЕНИЯ ====================

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Получен SIGTERM, завершаем работу...');
  server.close(() => {
    console.log('✅ HTTP сервер остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Получен SIGINT, завершаем работу...');
  server.close(() => {
    console.log('✅ HTTP сервер остановлен');
    process.exit(0);
  });
});