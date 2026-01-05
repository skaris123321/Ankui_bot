const { Events, ActivityType, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`\n✅ Бот ${client.user.tag} успешно запущен!`);
    console.log(`📊 Серверов: ${client.guilds.cache.size}`);
    console.log(`👥 Пользователей: ${client.users.cache.size}`);
    
    // Автоматическая регистрация команд (включая /stats)
    try {
      const commands = [];
      const commandsPath = path.join(__dirname, '..', 'commands');
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
          const command = require(filePath);
          if ('data' in command && 'execute' in command) {
            const commandData = command.data.toJSON();
            commands.push(commandData);
            console.log(`  ✅ Загружена команда: /${commandData.name}`);
          } else {
            console.log(`  ⚠️ Файл ${file} не содержит data и execute`);
          }
        } catch (error) {
          console.error(`  ❌ Ошибка загрузки команды ${file}:`, error);
        }
      }

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;

      if (clientId) {
        console.log(`🔄 Регистрирую ${commands.length} slash-команд...`);
        console.log(`📋 Список команд для регистрации:`, commands.map(c => `/${c.name}`).join(', '));
        const data = await rest.put(
          Routes.applicationCommands(clientId),
          { body: commands },
        );
        console.log(`✅ Успешно зарегистрировано ${data.length} slash-команд!`);
        console.log(`📋 Зарегистрированные команды:`, data.map(c => `/${c.name}`).join(', '));
      } else {
        console.log('⚠️ DISCORD_CLIENT_ID не установлен, команды не зарегистрированы');
      }
    } catch (error) {
      console.error('❌ Ошибка при регистрации команд:', error);
    }
    
    // Запускаем StreamTracker
    if (client.streamTracker) {
      client.streamTracker.start();
      console.log('✅ StreamTracker запущен');
    }
    
    // Устанавливаем статус бота
    const activities = [
      { name: 'за сервером', type: ActivityType.Watching },
      { name: '/help для помощи', type: ActivityType.Playing },
      { name: 'настройки в веб-панели', type: ActivityType.Listening }
    ];
    
    let currentActivity = 0;
    
    const updateActivity = () => {
      client.user.setActivity(activities[currentActivity]);
      currentActivity = (currentActivity + 1) % activities.length;
    };
    
    updateActivity();
    setInterval(updateActivity, 30000); // Меняем активность каждые 30 секунд
  },
};

