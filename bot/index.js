const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
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

// Коллекции для команд и событий
client.commands = new Collection();
client.events = new Collection();

// Загрузка команд
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Загружена команда: ${command.data.name}`);
    }
  }
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
client.on(Events.InteractionCreate, async interaction => {
  // Обработка кнопок выбора роли
  if (interaction.isButton()) {
    try {
      const customId = interaction.customId;
      
      // Проверяем, что это кнопка выбора роли (начинается с "role_select_")
      if (customId.startsWith('role_select_')) {
        const roleId = customId.replace('role_select_', '');
        const member = interaction.member;
        const guild = interaction.guild;
        
        if (!member || !guild) {
          await interaction.reply({ content: '❌ Ошибка: не удалось получить информацию о пользователе или сервере.', ephemeral: true });
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
          await interaction.reply({ content: '❌ Ошибка: группа ролей не найдена.', ephemeral: true });
          return;
        }
        
        // Получаем роль
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          await interaction.reply({ content: '❌ Ошибка: роль не найдена на сервере.', ephemeral: true });
          return;
        }
        
        // Проверяем, есть ли у пользователя уже эта роль
        const hasRole = member.roles.cache.has(roleId);
        
        if (hasRole) {
          // Убираем роль
          await member.roles.remove(role);
          await interaction.reply({ content: `✅ Роль ${role.name} удалена.`, ephemeral: true });
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
          await interaction.reply({ content: `✅ Роль ${role.name} выдана.`, ephemeral: true });
        }
      }
    } catch (error) {
      console.error('❌ Ошибка обработки кнопки:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Произошла ошибка при обработке кнопки.', ephemeral: true });
      }
    }
    return;
  }
  
  // Обработка slash команд
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ Команда ${interaction.commandName} не найдена`);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`❌ Ошибка выполнения команды ${interaction.commandName}:`, error);
    const errorMessage = { content: 'Произошла ошибка при выполнении команды!', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Вход в Discord
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Ошибка входа в Discord:', error);
  process.exit(1);
});

module.exports = client;

