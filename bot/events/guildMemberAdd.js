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

// Дополнительная защита: Set для отслеживания ключей, которые в процессе добавления
// Это помогает предотвратить race condition при одновременных вызовах
if (!global.welcomeMessageProcessing) {
  global.welcomeMessageProcessing = new Set();
  console.log(`✅ Глобальный Set welcomeMessageProcessing создан`);
} else {
  console.log(`⚠️ Глобальный Set welcomeMessageProcessing уже существует! Размер: ${global.welcomeMessageProcessing.size}`);
}

// Глобальный флаг для отслеживания выполнения обработчика
// Это дополнительная защита от одновременных вызовов
if (!global.welcomeHandlerExecuting) {
  global.welcomeHandlerExecuting = false;
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
    console.log(`📋 Ключ в Set ДО проверки: ${global.welcomeMessageProcessing.has(key)}`);
    console.log(`📋 Глобальный флаг выполнения: ${global.welcomeHandlerExecuting}`);
    
    // КРИТИЧЕСКАЯ ЗАЩИТА ОТ RACE CONDITION - ИСПОЛЬЗУЕМ MAP С ФЛАГОМ "В ПРОЦЕССЕ"
    // Используем Map для хранения флагов "в процессе" - это более надежно чем Set
    
    // Проверяем, не обрабатывается ли уже этот ключ
    const existingFlag = global.welcomeMessagePromises.get(key);
    if (existingFlag && existingFlag._processing) {
      console.log(`⚠️ [${key}] Ключ уже обрабатывается (флаг в Map), ждем...`);
      
      // Ждем завершения обработки
      let waitCount = 0;
      while (global.welcomeMessagePromises.has(key) && waitCount < 200) {
        const currentFlag = global.welcomeMessagePromises.get(key);
        if (!currentFlag || !currentFlag._processing) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
        waitCount++;
      }
      
      // Проверяем Promise
      const finalPromise = global.welcomeMessagePromises.get(key);
      if (finalPromise && finalPromise._resolve) {
        try {
          await finalPromise;
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      
      console.log(`✅ [${key}] Предыдущая обработка завершена, пропускаем этот вызов\n`);
      return;
    }
    
    // Создаем объект-флаг "в процессе" и СИНХРОННО добавляем в Map
    const processingFlag = { _processing: true };
    global.welcomeMessagePromises.set(key, processingFlag);
    
    // Двойная проверка - если кто-то успел добавить Promise между проверками
    const checkFlag = global.welcomeMessagePromises.get(key);
    if (checkFlag !== processingFlag) {
      // Кто-то успел добавить другой флаг - ждем
      console.log(`⚠️ [${key}] Другой обработчик успел добавить флаг, ждем...`);
      if (checkFlag && checkFlag._resolve) {
        try {
          await checkFlag;
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      console.log(`✅ [${key}] Предыдущая обработка завершена, пропускаем этот вызов\n`);
      return;
    }
    
    // Создаем Promise и заменяем флаг на Promise
    let resolvePromise;
    const newPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    newPromise._resolve = resolvePromise;
    newPromise._processing = true;
    global.welcomeMessagePromises.set(key, newPromise);
    let processingPromise = newPromise;
    
    // Добавляем в Set для совместимости
    global.welcomeMessageProcessing.add(key);
    
    console.log(`✅ [${key}] Ключ добавлен в Map и Set, начинаем обработку`);
    
    // Удаляем из Map через 10 секунд (на случай если Promise не разрешится)
    const timeoutId = setTimeout(() => {
      if (global.welcomeMessagePromises.has(key) && global.welcomeMessagePromises.get(key) === processingPromise) {
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
      
      // Проверяем, включено ли приветствие или изображение
      const welcomeEnabled = settings.welcome_enabled === 1 || settings.welcome_enabled === true || settings.welcome_enabled === '1' || Number(settings.welcome_enabled) === 1;
      const imageEnabled = settings.welcome_image_enabled === 1 || settings.welcome_image_enabled === true || settings.welcome_image_enabled === '1';
      
      // Если ни приветствие, ни изображение не включены - выходим
      if ((!welcomeEnabled && !imageEnabled) || !settings.welcome_channel_id) {
        console.log(`⚠️ [${key}] Приветствие и изображение отключены или канал не указан`);
        return;
      }
      
      const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
      
      if (!channel || !channel.isTextBased()) {
        console.error(`❌ [${key}] Канал не найден или не текстовый`);
        return;
      }
      
      // Подготавливаем текст приветствия
      let welcomeMessage = settings.welcome_message || 'Добро пожаловать, {mention}!';
      const mention = `<@${member.user.id}>`;
      welcomeMessage = welcomeMessage
        .replace(/{mention}/g, mention)
        .replace(/{user}/g, mention)
        .replace(/{username}/g, member.user.username)
        .replace(/{guild}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount);
      
      // Обрабатываем изображение
      if (imageEnabled) {
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
          
          // Отправляем текст ПЕРЕД изображением (если приветствие включено)
          if (welcomeEnabled) {
            await channel.send({ content: welcomeMessage });
          }
          
          // Отправляем изображение с круглым аватаром (thumbnail в Discord уже круглый)
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setImage(welcomeImageUrl)
            .setThumbnail(avatarUrl);
          
          await channel.send({ embeds: [embed] });
          console.log(`✅ [${key}] ${welcomeEnabled ? 'Текст и ' : ''}Изображение отправлено`);
        } else {
          // Если изображение включено, но URL не указан - отправляем только текст (если приветствие включено)
          if (welcomeEnabled) {
            await channel.send({ content: welcomeMessage });
            console.log(`✅ [${key}] Текстовое сообщение отправлено (изображение не указано)`);
          }
        }
      } else if (welcomeEnabled) {
        // Отправляем только текстовое сообщение, если приветствие включено
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
      // ВСЕГДА разрешаем Promise и удаляем из Set и Map
      clearTimeout(timeoutId);
      if (processingPromise && processingPromise._resolve) {
        processingPromise._resolve();
      }
      // Удаляем из Set
      global.welcomeMessageProcessing.delete(key);
      // Проверяем, что это все еще тот же Promise перед удалением из Map
      if (global.welcomeMessagePromises.get(key) === processingPromise) {
        global.welcomeMessagePromises.delete(key);
        console.log(`🗑️ [${key}] Ключ удален из Set и Map (обработка завершена)`);
      } else {
        console.log(`🗑️ [${key}] Ключ удален из Set (обработка завершена, Promise уже был удален)`);
      }
    }
  },
};

