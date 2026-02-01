const { Events, ActivityType } = require('discord.js');
const ActivityTracker = require('../services/activityTracker');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`\n✅ Бот ${client.user.tag} успешно запущен!`);
    console.log(`📊 Серверов: ${client.guilds.cache.size}`);
    console.log(`👥 Пользователей: ${client.users.cache.size}`);

    // Автоматическая регистрация команд при запуске
    try {
      console.log('🔄 Автоматическая регистрация команд...');
      
      const commands = [];
      client.commands.forEach(command => {
        commands.push(command.data.toJSON());
      });
      
      // Регистрируем команды для каждого сервера, где есть бот
      for (const guild of client.guilds.cache.values()) {
        try {
          await guild.commands.set(commands);
          console.log(`✅ Команды зарегистрированы для сервера: ${guild.name}`);
        } catch (error) {
          console.error(`❌ Ошибка регистрации команд для ${guild.name}:`, error.message);
        }
      }
      
      console.log(`✅ Автоматическая регистрация завершена для ${client.guilds.cache.size} серверов`);
    } catch (error) {
      console.error('❌ Ошибка автоматической регистрации команд:', error);
    }

    // Инициализируем ActivityTracker после готовности клиента
    if (!client.activityTracker) {
      client.activityTracker = new ActivityTracker(client, client.db);
      console.log('🎯 ActivityTracker инициализирован');

      // Инициализируем голосовые состояния для пользователей, уже находящихся в каналах
      setTimeout(() => {
        client.activityTracker.initializeVoiceStates();
      }, 2000); // Небольшая задержка для полной загрузки
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

