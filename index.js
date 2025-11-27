require('dotenv').config();
const { spawn } = require('child_process');

console.log('🚀 Запуск Discord бота и веб-панели управления...\n');

// Запускаем Discord бота
const bot = spawn('node', ['bot/index.js'], {
  stdio: 'inherit',
  shell: true
});

// Запускаем веб-сервер
const web = spawn('node', ['web/server.js'], {
  stdio: 'inherit',
  shell: true
});

// Обработка завершения процессов
bot.on('exit', (code) => {
  console.log(`❌ Бот завершил работу с кодом ${code}`);
  process.exit(code);
});

web.on('exit', (code) => {
  console.log(`❌ Веб-сервер завершил работу с кодом ${code}`);
  process.exit(code);
});

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Остановка бота и веб-сервера...');
  bot.kill();
  web.kill();
  process.exit(0);
});

