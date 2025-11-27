const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const Database = require('../database/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация базы данных
const db = new Database();

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));

// Маршруты
app.get('/', (req, res) => {
  res.render('index', { 
    user: req.session.user || null,
    page: 'home'
  });
});

app.get('/dashboard', async (req, res) => {
  try {
    const client = require('../bot/client');
    
    // Получаем список серверов бота
    let guilds = [];
    if (client && client.isReady()) {
      guilds = Array.from(client.guilds.cache.values()).map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }) || null,
        memberCount: guild.memberCount
      }));
    }
    
    res.render('dashboard', {
      user: req.session.user || { username: 'Гость', id: '0' },
      page: 'dashboard',
      guilds: guilds
    });
  } catch (error) {
    console.error('Ошибка загрузки дашборда:', error);
    res.render('dashboard', {
      user: req.session.user || { username: 'Гость', id: '0' },
      page: 'dashboard',
      guilds: []
    });
  }
});

app.get('/guild/:guildId', (req, res) => {
  const guildId = req.params.guildId;
  const settings = db.getGuildSettings(guildId) || {};
  
  res.render('guild-settings', {
    user: req.session.user || { username: 'Гость', id: '0' },
    page: 'guild-settings',
    guildId: guildId,
    settings: settings
  });
});

// API для сохранения настроек сервера
app.post('/api/guild/:guildId/settings', (req, res) => {
  const guildId = req.params.guildId;
  const settings = req.body;
  
  try {
    db.setGuildSettings(guildId, settings);
    res.json({ success: true, message: 'Настройки сохранены!' });
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
    res.status(500).json({ success: false, message: 'Ошибка сохранения настроек' });
  }
});

// API для получения настроек сервера
app.get('/api/guild/:guildId/settings', (req, res) => {
  const guildId = req.params.guildId;
  const settings = db.getGuildSettings(guildId);
  
  res.json(settings || {});
});

// API для получения предупреждений
app.get('/api/guild/:guildId/warnings/:userId', (req, res) => {
  const { guildId, userId } = req.params;
  const warnings = db.getWarnings(guildId, userId);
  
  res.json(warnings);
});

// API для получения модерационных логов
app.get('/api/guild/:guildId/modlogs', (req, res) => {
  const guildId = req.params.guildId;
  const limit = parseInt(req.query.limit) || 50;
  const logs = db.getModLogs(guildId, limit);
  
  res.json(logs);
});

// Страница документации
app.get('/docs', (req, res) => {
  res.render('docs', {
    user: req.session.user || null,
    page: 'docs'
  });
});

// Страница редактора Embed
app.get('/embed-editor', (req, res) => {
  res.render('embed-editor', {
    user: req.session.user || { username: 'Гость', id: '0' },
    page: 'embed-editor'
  });
});

// API для получения каналов сервера
app.get('/api/guild/:guildId/channels', async (req, res) => {
  const { guildId } = req.params;
  
  try {
    const client = require('../bot/client');
    
    if (!client || !client.isReady()) {
      return res.status(503).json({ 
        success: false, 
        message: 'Бот не подключен к Discord' 
      });
    }
    
    const guild = await client.guilds.fetch(guildId);
    
    if (!guild) {
      return res.status(404).json({ 
        success: false, 
        message: 'Сервер не найден' 
      });
    }
    
    // Получаем только текстовые каналы
    const channels = Array.from(guild.channels.cache.values())
      .filter(channel => channel.isTextBased())
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({ success: true, channels });
  } catch (error) {
    console.error('Ошибка получения каналов:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// API для отправки Embed в Discord
app.post('/api/send-embed', async (req, res) => {
  const { channelId, embed } = req.body;
  
  if (!channelId || !embed) {
    return res.status(400).json({ 
      success: false, 
      message: 'Не указан канал или данные embed' 
    });
  }
  
  try {
    // Получаем клиента бота
    const client = require('../bot/client');
    
    if (!client || !client.isReady()) {
      return res.status(503).json({ 
        success: false, 
        message: 'Бот не подключен к Discord' 
      });
    }
    
    // Получаем канал
    const channel = await client.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ 
        success: false, 
        message: 'Канал не найден или не является текстовым' 
      });
    }
    
    // Отправляем embed
    await channel.send({ embeds: [embed] });
    
    res.json({ 
      success: true, 
      message: 'Сообщение успешно отправлено!' 
    });
  } catch (error) {
    console.error('Ошибка отправки embed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка отправки сообщения' 
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`\n✅ Веб-панель управления запущена!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard\n`);
});

