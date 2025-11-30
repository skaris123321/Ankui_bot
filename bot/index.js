const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('../database/database');

// Создаем клиента Discord
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
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  
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
    
    // Удаляем все предыдущие обработчики этого события перед регистрацией нового (только для GuildMemberAdd)
    if (event.name === Events.GuildMemberAdd) {
      const listenerCount = client.listenerCount(event.name);
      if (listenerCount > 0) {
        console.log(`⚠️ Удаляем ${listenerCount} предыдущих обработчиков события ${event.name}`);
        client.removeAllListeners(event.name);
      }
    }
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
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

