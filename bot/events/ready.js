const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`\n✅ Бот ${client.user.tag} успешно запущен!`);
    console.log(`📊 Серверов: ${client.guilds.cache.size}`);
    console.log(`👥 Пользователей: ${client.users.cache.size}`);
    
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

