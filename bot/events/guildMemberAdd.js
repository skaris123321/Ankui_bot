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
    
    // СИНХРОННАЯ проверка глобального флага выполнения
    if (global.welcomeHandlerExecuting) {
      console.log(`⚠️ [${key}] Глобальный флаг выполнения установлен, пропускаем вызов\n`);
      return;
    }
    
    // Устанавливаем глобальный флаг СИНХРОННО
    global.welcomeHandlerExecuting = true;
    
    // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - выводим СРАЗУ при вызове обработчика
    console.log(`\n🔥🔥🔥 ОБРАБОТЧИК ВЫЗВАН! Пользователь: ${member.user.tag} (${userId}) на сервере ${guildId} 🔥🔥🔥`);
    console.log(`🔑 Уникальный ключ: ${key}`);
    console.log(`📋 Размер Map ДО проверки: ${global.welcomeMessagePromises.size}`);
    console.log(`📋 Ключ в Map ДО проверки: ${global.welcomeMessagePromises.has(key)}`);
    
    // КРИТИЧЕСКАЯ ЗАЩИТА ОТ RACE CONDITION - АТОМАРНАЯ БЛОКИРОВКА:
    // Используем синхронную проверку размера Set до и после добавления
    // Это гарантирует, что только один обработчик сможет пройти
    
    // АТОМАРНАЯ операция: проверяем размер ДО добавления, добавляем, проверяем размер ПОСЛЕ
    const sizeBefore = global.welcomeMessageProcessing.size;
    global.welcomeMessageProcessing.add(key);
    const sizeAfter = global.welcomeMessageProcessing.size;
    
    // Если размер не изменился, значит ключ уже был в Set - другой обработчик начал обработку
    if (sizeBefore === sizeAfter) {
      console.log(`⚠️ [${key}] Ключ уже был в Set (размер не изменился: ${sizeBefore} -> ${sizeAfter}), ждем...`);
      
      // Ждем, пока ключ не будет удален из Set
      let waitCount = 0;
      while (global.welcomeMessageProcessing.has(key) && waitCount < 200) {
        await new Promise(resolve => setTimeout(resolve, 25));
        waitCount++;
      }
      
      // Проверяем Promise в Map
      const existingPromise = global.welcomeMessagePromises.get(key);
      if (existingPromise) {
        try {
          await existingPromise;
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      
      console.log(`✅ [${key}] Предыдущая обработка завершена, пропускаем этот вызов\n`);
      return;
    }
    
    // Размер изменился - мы успешно добавили ключ первыми
    // Теперь проверяем Map на наличие Promise
    let processingPromise = global.welcomeMessagePromises.get(key);
    if (processingPromise) {
      // Кто-то успел добавить Promise - удаляем из Set и ждем
      global.welcomeMessageProcessing.delete(key);
      console.log(`⚠️ [${key}] Promise уже в Map, ждем...`);
      try {
        await processingPromise;
        console.log(`✅ [${key}] Предыдущая обработка завершена, пропускаем этот вызов\n`);
      } catch (e) {
        console.log(`⚠️ [${key}] Ошибка ожидания, пропускаем\n`);
      }
      return;
    }
    
    // Создаем Promise и добавляем в Map СИНХРОННО
    let resolvePromise;
    const newPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    newPromise._resolve = resolvePromise;
    global.welcomeMessagePromises.set(key, newPromise);
    processingPromise = newPromise;
    
    console.log(`✅ [${key}] Ключ добавлен в Set и Map (размер изменился: ${sizeBefore} -> ${sizeAfter}), начинаем обработку`);
    
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
      // ВСЕГДА сбрасываем глобальный флаг выполнения
      global.welcomeHandlerExecuting = false;
      
      // ВСЕГДА разрешаем Promise и удаляем из Set и Map
      clearTimeout(timeoutId);
      if (processingPromise && processingPromise._resolve) {
        processingPromise._resolve();
      }
      // Удаляем из Set (синхронно, первым делом)
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
