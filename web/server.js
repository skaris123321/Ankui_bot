const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Database = require('../database/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация базы данных
const db = new Database();

// Настройка папки для загрузок
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка Multer для сохранения файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя файла: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: function (req, file, cb) {
    // Разрешаем только изображения
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WEBP)'));
    }
  }
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '10mb' })); // Увеличиваем лимит для base64 изображений
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
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

app.get('/rules-editor', async (req, res) => {
  try {
    const client = require('../bot/client');
    
    let guilds = [];
    if (client && client.isReady()) {
      guilds = Array.from(client.guilds.cache.values()).map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }) || null,
        memberCount: guild.memberCount
      }));
    }
    
    res.render('rules-editor', {
      user: req.session.user || { username: 'Гость', id: '0' },
      page: 'rules-editor',
      guilds: guilds
    });
  } catch (error) {
    console.error('Ошибка при загрузке редактора правил:', error);
    res.status(500).render('error', { message: 'Не удалось загрузить редактор правил.' });
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

// API для загрузки изображений (через файл)
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Файл не был загружен' 
      });
    }
    
    // Возвращаем URL для доступа к файлу
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      url: fileUrl,
      filename: req.file.filename,
      message: 'Изображение успешно загружено и сохранено на сервере.' 
    });
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка при загрузке изображения' 
    });
  }
});

// API для загрузки изображений из base64 (для обратной совместимости)
app.post('/api/upload-image-base64', (req, res) => {
  try {
    const { imageData } = req.body; // base64 data URL
    
    if (!imageData || !imageData.startsWith('data:image/')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Неверный формат изображения' 
      });
    }
    
    // Извлекаем данные из base64
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ 
        success: false, 
        message: 'Неверный формат base64' 
      });
    }
    
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    
    // Проверка размера (максимум 10 МБ)
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > 10 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        message: 'Размер файла не должен превышать 10 МБ' 
      });
    }
    
    // Сохраняем файл
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `upload-${uniqueSuffix}.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    // Возвращаем URL для доступа к файлу
    const fileUrl = `/uploads/${filename}`;
    
    res.json({ 
      success: true, 
      url: fileUrl,
      filename: filename,
      message: 'Изображение успешно загружено и сохранено на сервере.' 
    });
  } catch (error) {
    console.error('Ошибка загрузки изображения из base64:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при загрузке изображения' 
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

