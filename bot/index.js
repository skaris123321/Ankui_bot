const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('../database/database');

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
  const listenerCount = client.listenerCount(Events.GuildMemberAdd);
  console.log(`🔍 Количество обработчиков GuildMemberAdd ПЕРЕД загрузкой: ${listenerCount}`);
  if (listenerCount > 0) {
    console.log(`⚠️ УДАЛЯЕМ ${listenerCount} предыдущих обработчиков события GuildMemberAdd`);
    client.removeAllListeners(Events.GuildMemberAdd);
    console.log(`✅ Обработчики удалены. Новое количество: ${client.listenerCount(Events.GuildMemberAdd)}`);
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
    
    // Для GuildMemberAdd - проверяем количество обработчиков ДО регистрации
    if (event.name === Events.GuildMemberAdd) {
      const beforeCount = client.listenerCount(Events.GuildMemberAdd);
      console.log(`📊 Количество обработчиков GuildMemberAdd ДО регистрации: ${beforeCount}`);
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
      }
    }
    
    registeredEvents.add(eventKey);
    console.log(`✅ Загружено событие: ${event.name}`);
  }
}

// Обработка взаимодействий (slash команды)
client.on(Events.InteractionCreate, async interaction => {
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

