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
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  }
}

// Создаем REST клиент
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Регистрируем команды
(async () => {
  try {
    console.log(`🔄 Начинаю регистрацию ${commands.length} slash-команд...`);

    // Глобальная регистрация команд (доступны на всех серверах)
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ Успешно зарегистрировано ${data.length} slash-команд глобально!`);
    console.log('\nЗарегистрированные команды:');
    data.forEach(cmd => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });
    console.log('\n💡 Команды могут появиться на серверах в течение 1 часа.');
    console.log('💡 Для мгновенного появления используйте регистрацию для конкретного сервера.');
  } catch (error) {
    console.error('❌ Ошибка при регистрации команд:', error);
  }
})();

