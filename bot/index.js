const { Client, GatewayIntentBits, Collection, Events, ActivityType, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('../database/database');
const StreamTracker = require('./services/streamTracker');

// КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - начало инициализации бота
console.log(`\n🚀🚀🚀 ===== ИНИЦИАЛИЗАЦИЯ БОТА - bot/index.js загружен ===== 🚀🚀🚀\n`);

// Создаем клиента Discord
console.log(`📦 Создание клиента Discord...`);
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});
console.log(`✅ Клиент Discord создан\n`);

// Инициализация базы данных
const db = new Database();
client.db = db;

// Инициализация StreamTracker
const streamTracker = new StreamTracker(client);
client.streamTracker = streamTracker;

// Инициализация ActivityTracker
const ActivityTracker = require('./services/activityTracker');
const activityTracker = new ActivityTracker(client);
client.activityTracker = activityTracker;

// Коллекции для команд и событий
client.commands = new Collection();
client.events = new Collection();

// Загрузка команд
const commandsPath = path.join(__dirname, 'commands');
console.log(`\n📂 Загрузка команд из: ${commandsPath}`);
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  console.log(`📄 Найдено файлов команд: ${commandFiles.length}`);
  console.log(`📄 Файлы: ${commandFiles.join(', ')}\n`);
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Загружена команда: ${command.data.name} (из файла ${file})`);
      } else {
        console.error(`❌ Файл ${file} не содержит data или execute`);
      }
    } catch (error) {
      console.error(`❌ Ошибка загрузки команды из ${file}:`, error);
    }
  }
  console.log(`\n📊 Итого загружено команд: ${client.commands.size}`);
  console.log(`📋 Список команд: ${Array.from(client.commands.keys()).join(', ')}\n`);
} else {
  console.error(`❌ Папка команд не найдена: ${commandsPath}`);
}

// Загрузка событий
const eventsPath = path.join(__dirname, 'events');
console.log(`\n📂 Загрузка событий из: ${eventsPath}\n`);
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  console.log(`📄 Найдено файлов событий: ${eventFiles.length}`);
  console.log(`📄 Файлы: ${eventFiles.join(', ')}\n`);
  
  // ВСЕГДА удаляем все обработчики GuildMemberAdd перед загрузкой
  // Это критически важно - если обработчик уже зарегистрирован, удаляем его
  const listenerCount = client.listenerCount(Events.GuildMemberAdd);
  console.log(`🔍 Количество обработчиков GuildMemberAdd ПЕРЕД загрузкой: ${listenerCount}`);
  if (listenerCount > 0) {
    console.error(`❌❌❌ ОБНАРУЖЕНО ${listenerCount} ОБРАБОТЧИКОВ GuildMemberAdd ПЕРЕД ЗАГРУЗКОЙ! ❌❌❌`);
    console.error(`❌ Это означает, что обработчик уже был зарегистрирован ранее!`);
    console.error(`❌ УДАЛЯЕМ ВСЕ обработчики...`);
    client.removeAllListeners(Events.GuildMemberAdd);
    const newCount = client.listenerCount(Events.GuildMemberAdd);
    console.log(`✅ Обработчики удалены. Новое количество: ${newCount}`);
    if (newCount !== 0) {
      console.error(`❌❌❌ ОШИБКА: После удаления осталось ${newCount} обработчиков! ❌❌❌`);
    }
  }
  
  // Отслеживаем уже зарегистрированные события, чтобы избежать дубликатов
  const registeredEvents = new Set();
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    // Проверяем, не зарегистрировано ли уже это событие
    const eventKey = `${event.name}_${file}`;
    if (registeredEvents.has(eventKey)) {
      console.log(`⚠️ Событие ${event.name} из файла ${file} уже зарегистрировано, пропускаем`);
      continue;
    }
    
    // Для GuildMemberAdd - КРИТИЧЕСКАЯ ЗАЩИТА ОТ ДВОЙНОЙ РЕГИСТРАЦИИ
    if (event.name === Events.GuildMemberAdd) {
      const beforeCount = client.listenerCount(Events.GuildMemberAdd);
      console.log(`📊 Количество обработчиков GuildMemberAdd ДО регистрации: ${beforeCount}`);
      
      // Если уже есть обработчики - УДАЛЯЕМ ВСЕ перед регистрацией
      if (beforeCount > 0) {
        console.error(`❌❌❌ ОБНАРУЖЕНО ${beforeCount} ОБРАБОТЧИКОВ GuildMemberAdd! ❌❌❌`);
        console.error(`❌ УДАЛЯЕМ ВСЕ обработчики перед регистрацией нового...`);
        client.removeAllListeners(Events.GuildMemberAdd);
        const afterRemove = client.listenerCount(Events.GuildMemberAdd);
        console.log(`✅ Обработчики удалены. Новое количество: ${afterRemove}`);
      }
    }
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    
    // Для GuildMemberAdd - проверяем количество обработчиков ПОСЛЕ регистрации
    if (event.name === Events.GuildMemberAdd) {
      const afterCount = client.listenerCount(Events.GuildMemberAdd);
      console.log(`📊 Количество обработчиков GuildMemberAdd ПОСЛЕ регистрации: ${afterCount}`);
      if (afterCount > 1) {
        console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Зарегистрировано ${afterCount} обработчиков GuildMemberAdd!`);
        console.error(`❌ Это может привести к двойной отправке приветственных сообщений!`);
        console.error(`❌ Удаляем все обработчики и регистрируем заново...`);
        client.removeAllListeners(Events.GuildMemberAdd);
        client.on(event.name, (...args) => event.execute(...args, client));
        const finalCount = client.listenerCount(Events.GuildMemberAdd);
        console.log(`✅ Повторно зарегистрирован 1 обработчик GuildMemberAdd. Итого: ${finalCount}`);
        if (finalCount !== 1) {
          console.error(`❌ ОШИБКА: После повторной регистрации количество обработчиков все еще ${finalCount}, ожидалось 1!`);
        }
      } else if (afterCount === 1) {
        console.log(`✅ Обработчик GuildMemberAdd успешно зарегистрирован (1 экземпляр)`);
      } else if (afterCount === 0) {
        console.error(`❌ ОШИБКА: Обработчик не был зарегистрирован!`);
      }
    }
    
    registeredEvents.add(eventKey);
    console.log(`✅ Загружено событие: ${event.name}`);
  }
}

// Обработка взаимодействий (slash команды и кнопки)
console.log(`\n📌 Регистрация обработчика InteractionCreate...`);

// КРИТИЧЕСКАЯ ЗАЩИТА ОТ ДВОЙНОЙ РЕГИСТРАЦИИ InteractionCreate
// Проверяем, не зарегистрирован ли уже обработчик
const interactionListenerCount = client.listenerCount(Events.InteractionCreate);
console.log(`📊 Количество обработчиков InteractionCreate ДО регистрации: ${interactionListenerCount}`);
if (interactionListenerCount > 0) {
  console.warn(`⚠️ ОБНАРУЖЕНО ${interactionListenerCount} ОБРАБОТЧИКОВ InteractionCreate!`);
  console.warn(`⚠️ УДАЛЯЕМ ВСЕ обработчики перед регистрацией нового...`);
  client.removeAllListeners(Events.InteractionCreate);
  const newCount = client.listenerCount(Events.InteractionCreate);
  console.log(`✅ Обработчики удалены. Новое количество: ${newCount}`);
  if (newCount !== 0) {
    console.error(`❌❌❌ ОШИБКА: После удаления осталось ${newCount} обработчиков! ❌❌❌`);
  }
}

// Защита от двойной обработки одного и того же interaction внутри процесса
const processedInteractions = new Set();
const INTERACTION_TTL_MS = 5_000; // держим id 5 секунд

client.on(Events.InteractionCreate, async interaction => {
  // Быстрый возрастной фильтр: если событие старше 3 секунд, не трогаем (уменьшает риск 10062)
  const ageMs = Date.now() - interaction.createdTimestamp;
  if (ageMs > 3000) {
    console.log(`⏭️ Пропуск interaction ${interaction.id}: возраст ${ageMs}мс > 3000мс`);
    return;
  }

  // Дедупликация внутри одного процесса
  if (processedInteractions.has(interaction.id)) {
    console.log(`⏭️ Interaction ${interaction.id} уже обработан, пропускаем`);
    return;
  }
  processedInteractions.add(interaction.id);
  setTimeout(() => processedInteractions.delete(interaction.id), INTERACTION_TTL_MS);

  console.log(`🔔 Событие InteractionCreate получено! Тип: ${interaction.type}, isButton: ${interaction.isButton()}, isChatInputCommand: ${interaction.isChatInputCommand()}`);
  
  // Обработка кнопок выбора роли
  if (interaction.isButton()) {
    try {
      const customId = interaction.customId;
      
      // Проверяем, что это кнопка статистики (начинается с "stats_")
      if (customId.startsWith('stats_')) {
        const parts = customId.split('_');
        const action = parts[1]; // back, next, delete
        const statsType = parts[2]; // messages или voice
        const userId = parts[parts.length - 1]; // ID пользователя, который вызвал команду
        
        // Проверяем, что кнопку нажал тот же пользователь, который вызвал команду
        if (interaction.user.id !== userId) {
          await interaction.reply({ 
            content: '❌ Только пользователь, вызвавший команду, может управлять статистикой.', 
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        // ID разрешенного канала spam-chat
        const allowedChannelId = '1444744987677032538';
        
        // Проверяем, что команда используется в разрешенном канале (по ID или имени)
        if (interaction.channel.id !== allowedChannelId && interaction.channel.name !== 'spam-chat' && !interaction.channel.name.includes('spam')) {
          await interaction.reply({ 
            content: '❌ Эта команда доступна только в канале spam-chat!', 
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (action === 'delete') {
          await interaction.message.delete();
          return;
        }

        // Получаем текущую страницу из customId
        const currentPage = parseInt(parts[3]) || 0;
        let newPage = currentPage;

        if (action === 'back') {
          newPage = Math.max(0, currentPage - 1);
        } else if (action === 'next') {
          newPage = currentPage + 1;
        }

        // Получаем всех пользователей
        client.db.load();
        const allUsers = Object.values(client.db.data.userLevels || {})
          .filter(user => user.guild_id === interaction.guild.id);

        let sortedUsers = [];
        let title = '';

        if (statsType === 'messages') {
          sortedUsers = allUsers
            .sort((a, b) => (b.messages || 0) - (a.messages || 0))
            .slice(0, 140);
          title = 'Топ пользователей по сообщениям';
        } else if (statsType === 'voice') {
          sortedUsers = allUsers
            .sort((a, b) => (b.voiceTime || 0) - (a.voiceTime || 0))
            .slice(0, 140);
          title = 'Топ пользователей по онлайну';
        }

        // Функция для форматирования времени
        const formatTime = (seconds) => {
          const days = Math.floor(seconds / 86400);
          const hours = Math.floor((seconds % 86400) / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          
          if (days > 0) {
            return `${days} дней, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          } else {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          }
        };

        // Создаем embed для новой страницы
        const itemsPerPage = 20;
        const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
        const startIndex = newPage * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, sortedUsers.length);
        const pageUsers = sortedUsers.slice(startIndex, endIndex);

        let description = '';
        for (let i = 0; i < pageUsers.length; i++) {
          const userData = pageUsers[i];
          const rank = startIndex + i + 1;
          
          try {
            const member = interaction.guild.members.cache.get(userData.user_id);
            const username = member ? member.displayName : `<@${userData.user_id}>`;
            
            let value = '';
            if (statsType === 'messages') {
              value = `${userData.messages || 0} 💬`;
            } else {
              const voiceSeconds = userData.voiceTime || 0;
              value = `${formatTime(voiceSeconds)} 🎙️`;
            }
            
            description += `${rank}. ${username} - ${value}\n`;
          } catch (error) {
            description += `${rank}. <@${userData.user_id}> - ${statsType === 'messages' ? (userData.messages || 0) + ' 💬' : formatTime(userData.voiceTime || 0) + ' 🎙️'}\n`;
          }
        }

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(title)
          .setDescription(description)
          .setFooter({ 
            text: `Вызвал: ${interaction.user.displayName} • Страница ${newPage + 1}/${totalPages}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`stats_back_${statsType}_${newPage}_${userId}`)
              .setLabel('Назад')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(newPage === 0),
            new ButtonBuilder()
              .setCustomId(`stats_delete_${statsType}_${userId}`)
              .setLabel('Удалить')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`stats_next_${statsType}_${newPage}_${userId}`)
              .setLabel('Вперед')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(newPage >= totalPages - 1)
          );

        await interaction.update({ embeds: [embed], components: [row] });
        return;
      }

      // Проверяем, что это кнопка выбора роли (начинается с "role_select_")
      if (customId.startsWith('role_select_')) {
        const roleId = customId.replace('role_select_', '');
        const member = interaction.member;
        const guild = interaction.guild;
        
        if (!member || !guild) {
          await interaction.reply({ content: '❌ Ошибка: не удалось получить информацию о пользователе или сервере.', flags: MessageFlags.Ephemeral });
          return;
        }
        
        // Получаем информацию о группе ролей из базы данных
        const settings = client.db.getGuildSettings(guild.id) || {};
        const roleButtons = settings.role_buttons || {};
        
        // Находим группу, к которой принадлежит эта роль
        let roleGroup = null;
        let messageId = null;
        
        for (const [msgId, group] of Object.entries(roleButtons)) {
          if (group.roles && group.roles.some(r => r.roleId === roleId)) {
            roleGroup = group;
            messageId = msgId;
            break;
          }
        }
        
        if (!roleGroup || !roleGroup.roles) {
          await interaction.reply({ content: '❌ Ошибка: группа ролей не найдена.', flags: MessageFlags.Ephemeral });
          return;
        }
        
        // Получаем роль
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          await interaction.reply({ content: '❌ Ошибка: роль не найдена на сервере.', flags: MessageFlags.Ephemeral });
          return;
        }
        
        // Проверяем, есть ли у пользователя уже эта роль
        const hasRole = member.roles.cache.has(roleId);
        
        if (hasRole) {
          // Убираем роль
          await member.roles.remove(role);
          await interaction.reply({ content: `✅ Роль ${role.name} удалена.`, flags: MessageFlags.Ephemeral });
        } else {
          // Убираем все роли из группы (взаимоисключающий выбор)
          for (const roleData of roleGroup.roles) {
            if (member.roles.cache.has(roleData.roleId)) {
              const otherRole = await guild.roles.fetch(roleData.roleId).catch(() => null);
              if (otherRole) {
                await member.roles.remove(otherRole);
              }
            }
          }
          
          // Выдаем выбранную роль
          await member.roles.add(role);
          await interaction.reply({ content: `✅ Роль ${role.name} выдана.`, flags: MessageFlags.Ephemeral });
        }
      }
    } catch (error) {
      console.error('❌ Ошибка обработки кнопки:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Произошла ошибка при обработке кнопки.', flags: MessageFlags.Ephemeral });
      }
    }
    return;
  }
  
  // Обработка slash команд
  if (!interaction.isChatInputCommand()) {
    console.log(`⏭️ Пропуск взаимодействия: не является ChatInputCommand (тип: ${interaction.type})`);
    return;
  }

  console.log(`🔍 Получена команда: /${interaction.commandName} от ${interaction.user.tag}`);
  console.log(`📋 Загруженные команды в памяти: ${Array.from(client.commands.keys()).join(', ')}`);
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ Команда ${interaction.commandName} не найдена`);
    console.log(`Доступные команды: ${Array.from(client.commands.keys()).join(', ')}`);
    console.error(`❌ Попытка ответа на несуществующую команду...`);
    try {
      await interaction.reply({ 
        content: `❌ Команда \`/${interaction.commandName}\` не найдена. Используйте \`/help\` для списка доступных команд.`, 
        flags: MessageFlags.Ephemeral 
      });
    } catch (error) {
      console.error(`❌ Ошибка при отправке ответа:`, error);
    }
    return;
  }
  
  try {
    // ВАЖНО: Не добавляйте логирование перед execute() - это может вызвать таймаут взаимодействия!
    // Команда должна вызвать deferReply() в течение 3 секунд
    await command.execute(interaction, client);
    // Логируем успех только если взаимодействие не было пропущено (не было ошибки 10062)
    // Проверяем, что взаимодействие было обработано
    if (interaction.deferred || interaction.replied) {
      console.log(`✅ Команда ${interaction.commandName} выполнена успешно (deferred: ${interaction.deferred}, replied: ${interaction.replied})`);
    } else {
      console.warn(`⚠️ Команда ${interaction.commandName} выполнена, но взаимодействие не было обработано (deferred: ${interaction.deferred}, replied: ${interaction.replied})`);
    }
  } catch (error) {
    // Ошибка 10062 - взаимодействие уже обработано другим экземпляром или истекло
    // Это нормальная ситуация, не логируем как ошибку
    if (error.code === 10062) {
      // Тихая обработка - просто выходим
      return;
    }
    
    // Для других ошибок логируем
    console.error(`❌ Ошибка выполнения команды ${interaction.commandName}:`, error.message || error);
    if (error.stack && error.code !== 10062) {
      console.error('Stack trace:', error.stack);
    }
    
    const errorMessage = { content: 'Произошла ошибка при выполнении команды!', flags: MessageFlags.Ephemeral };
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    } catch (replyError) {
      // Игнорируем ошибки ответа, если взаимодействие уже обработано
      if (replyError.code !== 10062) {
        console.error('❌ Не удалось отправить сообщение об ошибке:', replyError.message || replyError);
      }
    }
  }
});

// Проверка регистрации обработчика
const finalListenerCount = client.listenerCount(Events.InteractionCreate);
console.log(`\n✅ Обработчик InteractionCreate зарегистрирован`);
console.log(`📊 Количество обработчиков InteractionCreate ПОСЛЕ регистрации: ${finalListenerCount}`);
if (finalListenerCount === 0) {
  console.error(`❌❌❌ КРИТИЧЕСКАЯ ОШИБКА: Обработчик InteractionCreate не зарегистрирован! ❌❌❌`);
} else if (finalListenerCount > 1) {
  console.error(`❌❌❌ КРИТИЧЕСКАЯ ОШИБКА: Зарегистрировано ${finalListenerCount} обработчиков InteractionCreate! ❌❌❌`);
  console.error(`❌ Это может привести к двойной обработке команд!`);
  console.error(`❌ Удаляем все обработчики и регистрируем заново...`);
  client.removeAllListeners(Events.InteractionCreate);
  // Перерегистрируем обработчик (код обработчика нужно будет вынести в функцию)
  console.error(`⚠️ ТРЕБУЕТСЯ ПЕРЕЗАПУСК БОТА для исправления двойной регистрации!`);
} else if (finalListenerCount === 1) {
  console.log(`✅ Обработчик InteractionCreate успешно зарегистрирован (1 экземпляр)`);
}

// Вход в Discord
console.log(`\n🔐 Подключение к Discord...`);
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log(`✅ Токен принят, ожидание подключения...`);
}).catch(error => {
  console.error('❌ Ошибка входа в Discord:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

module.exports = client;

