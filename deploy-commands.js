require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'bot', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Загружаем все команды
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`✅ Загружена команда: ${command.data.name}`);
    } else {
      console.log(`❌ Команда ${file} не имеет data или execute`);
    }
  } catch (error) {
    console.log(`❌ Ошибка загрузки команды ${file}:`, error.message);
  }
}

// Создаем REST клиент
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Регистрируем команды
(async () => {
  try {
    console.log(`🔄 Начинаю регистрацию ${commands.length} slash-команд...`);

    // Если указан GUILD_ID, регистрируем для конкретного сервера (быстро)
    if (process.env.GUILD_ID) {
      console.log(`📍 Регистрация для сервера: ${process.env.GUILD_ID}`);
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`✅ Успешно зарегистрировано ${data.length} slash-команд для сервера!`);
    } else {
      // Глобальная регистрация команд (доступны на всех серверах)
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`✅ Успешно зарегистрировано ${data.length} slash-команд глобально!`);
      console.log('💡 Команды могут появиться на серверах в течение 1 часа.');
    }
    
    console.log('\nЗарегистрированные команды:');
    commands.forEach(cmd => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });
  } catch (error) {
    console.error('❌ Ошибка при регистрации команд:', error);
    
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.log('💡 Проблема с подключением к Discord API. Попробуйте позже.');
    } else if (error.code === 50001) {
      console.log('💡 Проверьте права бота и правильность CLIENT_ID');
    }
  }
})();

