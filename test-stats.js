// Скрипт для добавления тестовых данных статистики
const Database = require('./database/database');

const db = new Database();

// Добавляем тестовые данные
const testGuildId = '1282500340712996982'; // Замени на ID твоего сервера
const testUsers = [
  { id: '123456789012345678', messages: 150, voiceTime: 3600000 }, // 1 час
  { id: '234567890123456789', messages: 89, voiceTime: 7200000 },  // 2 часа
  { id: '345678901234567890', messages: 234, voiceTime: 1800000 }, // 30 минут
  { id: '456789012345678901', messages: 45, voiceTime: 5400000 },  // 1.5 часа
  { id: '567890123456789012', messages: 12, voiceTime: 900000 },   // 15 минут
];

console.log('📊 Добавление тестовых данных статистики...');

testUsers.forEach((user, index) => {
  db.setUserStats(testGuildId, user.id, {
    messages: user.messages,
    voiceTime: user.voiceTime,
    lastActive: Date.now() - (index * 3600000) // Разное время последней активности
  });
  
  console.log(`✅ Добавлен пользователь ${user.id}: ${user.messages} сообщений, ${Math.floor(user.voiceTime/60000)} минут в войсе`);
});

console.log('✅ Тестовые данные добавлены!');
console.log('Теперь можешь протестировать команду /stats');