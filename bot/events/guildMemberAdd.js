const { Events, EmbedBuilder } = require('discord.js');

// КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - модуль загружается
console.log(`\n🔵🔵🔵 МОДУЛЬ guildMemberAdd.js ЗАГРУЖЕН 🔵🔵🔵\n`);

// Глобальная защита от двойной отправки - используем Map с Promise для блокировки
// Это гарантирует, что защита работает даже если модуль загружается несколько раз
if (!global.welcomeMessagePromises) {
  global.welcomeMessagePromises = new Map();
  console.log(`✅ Глобальный Map welcomeMessagePromises создан`);
} else {
  console.log(`⚠️ Глобальный Map welcomeMessagePromises уже существует! Размер: ${global.welcomeMessagePromises.size}`);
}

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    const guildId = member.guild.id;
    const userId = member.user.id;
    const key = `${guildId}-${userId}`;
    
    // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - выводим СРАЗУ при вызове обработчика
    console.log(`\n🔥🔥🔥 ОБРАБОТЧИК ВЫЗВАН! Пользователь: ${member.user.tag} (${userId}) на сервере ${guildId} 🔥🔥🔥`);
    console.log(`🔑 Уникальный ключ: ${key}`);
    console.log(`📋 Размер Map ДО проверки: ${global.welcomeMessagePromises.size}`);
    console.log(`📋 Ключ в Map ДО проверки: ${global.welcomeMessagePromises.has(key)}`);
    
    // Если уже обрабатывается - ждем завершения и выходим
    if (global.welcomeMessagePromises.has(key)) {
      console.log(`⚠️ [${key}] Пользователь ${member.user.tag} уже обрабатывается, ждем завершения...`);
      try {
        await global.welcomeMessagePromises.get(key);
        console.log(`✅ [${key}] Предыдущая обработка завершена, пропускаем этот вызов`);
      } catch (e) {
        // Игнорируем ошибки
      }
      return;
    }
    
    // Создаем Promise для блокировки - СИНХРОННО добавляем в Map
    let resolvePromise;
    const processingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    
    // СИНХРОННО добавляем в Map ПЕРЕД любыми асинхронными операциями
    global.welcomeMessagePromises.set(key, processingPromise);
    console.log(`✅ [${key}] Ключ добавлен в Map, начинаем обработку`);
    
    // Удаляем из Map через 10 секунд (на случай если Promise не разрешится)
    setTimeout(() => {
      if (global.welcomeMessagePromises.has(key)) {
        global.welcomeMessagePromises.delete(key);
        console.log(`🗑️ [${key}] Ключ удален из Map (таймаут 10 сек)`);
      }
    }, 10000);
    
    // Обрабатываем в try-finally, чтобы гарантированно разрешить Promise
    try {
      console.log(`🔄 [${key}] Начало обработки приветствия для ${member.user.tag}`);
      
      const settings = client.db.getGuildSettings(guildId);
      
      if (!settings) {
        console.log(`⚠️ [${key}] Настройки для сервера не найдены`);
        return;
      }
      
      const welcomeEnabled = settings.welcome_enabled === 1 || settings.welcome_enabled === true || settings.welcome_enabled === '1' || Number(settings.welcome_enabled) === 1;
      
      if (!welcomeEnabled || !settings.welcome_channel_id) {
        console.log(`⚠️ [${key}] Приветствие отключено или канал не указан`);
        return;
      }
      
      const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
      
      if (!channel || !channel.isTextBased()) {
        console.error(`❌ [${key}] Канал не найден или не текстовый`);
        return;
      }
      
      let welcomeMessage = settings.welcome_message || 'Добро пожаловать, {mention}!';
      const mention = `<@${member.user.id}>`;
      welcomeMessage = welcomeMessage
        .replace(/{mention}/g, mention)
        .replace(/{user}/g, mention)
        .replace(/{username}/g, member.user.username)
        .replace(/{guild}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount);
      
      const imageEnabled = settings.welcome_image_enabled === 1 || settings.welcome_image_enabled === true || settings.welcome_image_enabled === '1';
      
      if (imageEnabled) {
        const sendType = settings.welcome_image_send_type || 'channel';
        let welcomeImageUrl = settings.welcome_image_background || '';
        
        if (welcomeImageUrl && welcomeImageUrl.startsWith('/uploads/')) {
          // Определяем базовый URL - проверяем переменные окружения Render/Railway/etc
          let baseUrl = process.env.WEB_SERVER_URL || process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_STATIC_URL;
          
          if (!baseUrl) {
            // Проверяем наличие переменных, указывающих на Render
            // Render устанавливает RENDER=true и RENDER_SERVICE_NAME
            if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME) {
              // На Render - пытаемся определить URL из названия сервиса
              const serviceName = process.env.RENDER_SERVICE_NAME || 'ankui-bot';
              baseUrl = `https://${serviceName}.onrender.com`;
            } else if (process.env.RAILWAY_ENVIRONMENT) {
              // На Railway
              baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${process.env.PORT || 3000}`;
            } else {
              // Локальная разработка
              baseUrl = `http://localhost:${process.env.PORT || 3000}`;
            }
          }
          
          // Убираем trailing slash если есть
          baseUrl = baseUrl.replace(/\/$/, '');
          welcomeImageUrl = baseUrl + welcomeImageUrl;
          
          console.log(`🔗 [${key}] Преобразован URL изображения: ${welcomeImageUrl}`);
        }
        
        if (welcomeImageUrl) {
          const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, dynamic: true });
          
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setImage(welcomeImageUrl)
            .setThumbnail(avatarUrl);
          
          // Отправляем сообщение
          if (sendType === 'channel') {
            await channel.send({ embeds: [embed] });
            console.log(`✅ [${key}] Изображение отправлено`);
          } else if (sendType === 'with') {
            await channel.send({ content: welcomeMessage, embeds: [embed] });
            console.log(`✅ [${key}] Изображение и текст отправлены вместе`);
          } else if (sendType === 'before') {
            await channel.send({ embeds: [embed] });
            await channel.send({ content: welcomeMessage });
            console.log(`✅ [${key}] Изображение и текст отправлены отдельно`);
          }
        } else {
          // Отправляем текстовое сообщение
          await channel.send({ content: welcomeMessage });
          console.log(`✅ [${key}] Текстовое сообщение отправлено (без изображения)`);
        }
      } else {
        // Отправляем текстовое сообщение
        await channel.send({ content: welcomeMessage });
        console.log(`✅ [${key}] Текстовое сообщение отправлено`);
      }
      
      // Выдача авто-роли
      if (settings.auto_role_id) {
        const role = await member.guild.roles.fetch(settings.auto_role_id).catch(() => null);
        if (role) {
          await member.roles.add(role).catch(() => {});
        }
      }
      
      console.log(`✅✅✅ [${key}] Обработка завершена успешно ✅✅✅\n`);
    } catch (error) {
      console.error(`❌ [${key}] Ошибка обработки приветствия:`, error);
    } finally {
      // ВСЕГДА разрешаем Promise и удаляем из Map
      if (resolvePromise) {
        resolvePromise();
      }
      global.welcomeMessagePromises.delete(key);
      console.log(`🗑️ [${key}] Ключ удален из Map (обработка завершена)`);
    }
  },
};
