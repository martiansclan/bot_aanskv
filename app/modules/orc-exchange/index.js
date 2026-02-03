const express = require('express');
const path = require('path');
const config = require('./orc-exchange.config');
const routes = require('./orc-exchange.routes');

module.exports = {
    name: config.name,
    title: config.title,
    description: config.description,
    version: config.version,
    
    // Функция для регистрации модуля в приложении
    register: (app, basePath = '/orc-exchange') => {
        // API маршруты
        app.use(`${basePath}/api`, routes);
        
        // Статические файлы
        app.use(`${basePath}/static`, express.static(path.join(__dirname, '../../../public')));
        
        // HTML страница
        app.get(`${basePath}`, (req, res) => {
            res.sendFile(path.join(__dirname, '../../../public/orc-exchange.html'));
        });
        
        console.log(`Модуль "${config.title}" зарегистрирован`);
        console.log(`  API: ${basePath}/api`);
        console.log(`  Страница: ${basePath}`);
        console.log(`  Статика: ${basePath}/static`);
    },
    
    config,
    routes
};