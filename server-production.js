// Production server - объединяет Discord бота и веб-панель для Render.com
require('dotenv').config();

console.log('🚀 Запуск Discord бота и веб-панели управления...');

// Запускаем Discord бота
require('./bot/index.js');

// Запускаем веб-сервер
require('./web/server.js');