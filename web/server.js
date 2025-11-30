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
    let name = path.basename(file.originalname, ext);
    
    // Убираем пробелы и недопустимые символы из имени файла
    // Заменяем пробелы на подчеркивания, удаляем специальные символы
    name = name.replace(/\s+/g, '_')  // Пробелы -> подчеркивания
               .replace(/[^a-zA-Z0-9_-]/g, '')  // Удаляем все кроме букв, цифр, дефисов и подчеркиваний
               .substring(0, 50);  // Ограничиваем длину
    
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
      user: req.session.user || null,
      page: 'dashboard',
      currentPage: 'embed-editor',
      guilds: guilds
    });
  } catch (error) {
    console.error('Ошибка загрузки дашборда:', error);
    res.render('dashboard', {
      user: req.session.user || null,
      page: 'dashboard',
      currentPage: 'embed-editor',
      guilds: []
    });
  }
});

// Маршрут для страницы Обзор
app.get('/dashboard/overview', async (req, res) => {
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
    
    res.render('overview', {
      user: req.session.user || null,
      page: 'dashboard',
      currentPage: 'overview',
      guilds: guilds
    });
  } catch (error) {
    console.error('Ошибка загрузки обзора:', error);
    res.render('overview', {
      user: req.session.user || null,
      page: 'dashboard',
      currentPage: 'overview',
      guilds: []
    });
  }
});

// Маршрут для страницы Добро пожаловать
app.get('/dashboard/welcomer', async (req, res) => {
  try {
    const client = require('../bot/client');
    const guildId = req.query.guild || req.query.server;
    
    let guilds = [];
    let channels = [];
    let settings = null;
    
    if (client && client.isReady()) {
      guilds = Array.from(client.guilds.cache.values()).map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }) || null,
        memberCount: guild.memberCount
      }));
      
      if (guildId) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          channels = Array.from(guild.channels.cache.values())
            .filter(ch => ch.isTextBased())
            .map(ch => ({
              id: ch.id,
              name: ch.name,
              type: ch.type
            }));
          
          settings = db.getGuildSettings(guildId) || {};
        }
      }
    }
    
    res.render('welcomer', {
      user: req.session.user || null,
      page: 'dashboard',
      currentPage: 'welcomer',
      guilds: guilds,
      channels: channels,
      selectedGuildId: guildId || null,
      settings: settings
    });
  } catch (error) {
    console.error('Ошибка загрузки настроек приветствия:', error);
    res.render('welcomer', {
      user: req.session.user || null,
      page: 'dashboard',
      currentPage: 'welcomer',
      guilds: [],
      channels: [],
      selectedGuildId: null,
      settings: null
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

// API для сохранения настроек приветствия
app.post('/api/guild/:guildId/welcomer', (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    // Обновляем настройки в базе данных
    db.setGuildSettings(guildId, {
      welcome_enabled: settings.welcome_enabled || 0,
      welcome_channel_id: settings.welcome_channel_id || '',
      welcome_message: settings.welcome_message || '',
      goodbye_enabled: settings.goodbye_enabled || 0,
      goodbye_channel_id: settings.goodbye_channel_id || '',
      goodbye_message: settings.goodbye_message || ''
    });
    
    res.json({
      success: true,
      message: 'Настройки приветствия успешно сохранены'
    });
  } catch (error) {
    console.error('Ошибка сохранения настроек приветствия:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка сохранения настроек'
    });
  }
});

// API для получения списка серверов
app.get('/api/guilds', async (req, res) => {
  try {
    const client = require('../bot/client');
    
    if (!client || !client.isReady()) {
      return res.json([]);
    }
    
    const guilds = Array.from(client.guilds.cache.values()).map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ dynamic: true, size: 128 }) || null,
      memberCount: guild.memberCount
    }));
    
    res.json(guilds);
  } catch (error) {
    console.error('Ошибка получения серверов:', error);
    res.json([]);
  }
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
// API для сохранения настроек приветствия
app.post('/api/guild/:guildId/welcomer', (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    // Получаем текущие настройки, чтобы не перезаписать другие
    const currentSettings = db.getGuildSettings(guildId) || {};
    
    // Обновляем настройки в базе данных
    db.setGuildSettings(guildId, {
      ...currentSettings,
      welcome_enabled: settings.welcome_enabled || 0,
      welcome_channel_id: settings.welcome_channel_id || '',
      welcome_message: settings.welcome_message || '',
      welcome_image_enabled: settings.welcome_image_enabled || 0,
      welcome_image_send_type: settings.welcome_image_send_type || 'channel',
      welcome_image_background_type: settings.welcome_image_background_type || 'image',
      welcome_image_background: settings.welcome_image_background || '',
      welcome_image_background_color: settings.welcome_image_background_color || '',
      welcome_image_username_text: settings.welcome_image_username_text || '',
      welcome_image_username_color: settings.welcome_image_username_color || '',
      welcome_image_text: settings.welcome_image_text || '',
      welcome_image_text_color: settings.welcome_image_text_color || '',
      goodbye_enabled: settings.goodbye_enabled || 0,
      goodbye_channel_id: settings.goodbye_channel_id || '',
      goodbye_message: settings.goodbye_message || ''
    });
    
    res.json({
      success: true,
      message: 'Настройки приветствия успешно сохранены'
    });
  } catch (error) {
    console.error('Ошибка сохранения настроек приветствия:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка сохранения настроек'
    });
  }
});

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

// Страница визуального редактора правил
app.get('/rules-visual-editor', async (req, res) => {
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
    
    res.render('rules-visual-editor', {
      user: req.session.user || { username: 'Гость', id: '0' },
      page: 'rules-visual-editor',
      guilds: guilds
    });
  } catch (error) {
    console.error('Ошибка при загрузке редактора правил:', error);
    res.render('rules-visual-editor', {
      user: req.session.user || { username: 'Гость', id: '0' },
      page: 'rules-visual-editor',
      guilds: []
    });
  }
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
  const { channelId, embed, embeds } = req.body;
  
  if (!channelId || (!embed && !embeds)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Не указан канал или данные embed' 
    });
  }
  
  // Поддержка как одного embed, так и массива embeds
  const embedsArray = embeds || (embed ? [embed] : []);
  
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
    
    // Функция для валидации и кодирования URL
    function validateAndCleanUrl(url) {
      if (!url || typeof url !== 'string') return null;
      
      // Убираем пробелы только в начале и конце
      url = url.trim();
      
      // Проверяем, что это валидный URL
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          console.warn('Невалидный протокол URL:', url);
          return null;
        }
        // Кодируем путь (pathname) - заменяет пробелы на %20
        urlObj.pathname = encodeURI(urlObj.pathname);
        return urlObj.toString();
      } catch (error) {
        // Если не удалось распарсить, пытаемся кодировать вручную
        try {
          // Пробуем кодировать весь URL
          return encodeURI(url);
        } catch {
          console.warn('Невалидный URL:', url, error.message);
          return null;
        }
      }
    }
    
    // Валидируем и очищаем URL изображений для всех embeds
    const validatedEmbeds = embedsArray.map(embedItem => {
      const validatedEmbed = { ...embedItem };
      
      if (validatedEmbed.image && validatedEmbed.image.url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.image.url);
        if (cleanedUrl) {
          validatedEmbed.image.url = cleanedUrl;
        } else {
          delete validatedEmbed.image;
        }
      }
      
      if (validatedEmbed.thumbnail && validatedEmbed.thumbnail.url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.thumbnail.url);
        if (cleanedUrl) {
          validatedEmbed.thumbnail.url = cleanedUrl;
        } else {
          delete validatedEmbed.thumbnail;
        }
      }
      
      if (validatedEmbed.author && validatedEmbed.author.icon_url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.author.icon_url);
        if (cleanedUrl) {
          validatedEmbed.author.icon_url = cleanedUrl;
        } else {
          delete validatedEmbed.author.icon_url;
        }
      }
      
      if (validatedEmbed.footer && validatedEmbed.footer.icon_url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.footer.icon_url);
        if (cleanedUrl) {
          validatedEmbed.footer.icon_url = cleanedUrl;
        } else {
          delete validatedEmbed.footer.icon_url;
        }
      }
      
      return validatedEmbed;
    });
    
    console.log('📤 Отправка embeds в Discord:', JSON.stringify(validatedEmbeds, null, 2));
    
    // Отправляем все embeds в одном сообщении (обычная отправка)
    const sentMessage = await channel.send({ embeds: validatedEmbeds });
    
    res.json({ 
      success: true, 
      message: 'Сообщение успешно отправлено!',
      messageId: sentMessage.id,
      channelId: channelId
    });
  } catch (error) {
    console.error('Ошибка отправки embed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка отправки сообщения' 
    });
  }
});

// API для отправки правил в Discord (все embeds в одном сообщении)
app.post('/api/send-rules', async (req, res) => {
  const { channelId, embeds } = req.body;
  
  if (!channelId || !embeds || !Array.isArray(embeds) || embeds.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Не указан канал или данные embeds' 
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
    
    // Функция для валидации и кодирования URL
    function validateAndCleanUrl(url) {
      if (!url || typeof url !== 'string') return null;
      
      url = url.trim();
      
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          console.warn('Невалидный протокол URL:', url);
          return null;
        }
        urlObj.pathname = encodeURI(urlObj.pathname);
        return urlObj.toString();
      } catch (error) {
        try {
          return encodeURI(url);
        } catch {
          console.warn('Невалидный URL:', url, error.message);
          return null;
        }
      }
    }
    
    // Валидируем и очищаем URL изображений для всех embeds
    const validatedEmbeds = embeds.map(embedItem => {
      const validatedEmbed = { ...embedItem };
      
      if (validatedEmbed.image && validatedEmbed.image.url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.image.url);
        if (cleanedUrl) {
          validatedEmbed.image.url = cleanedUrl;
        } else {
          delete validatedEmbed.image;
        }
      }
      
      if (validatedEmbed.thumbnail && validatedEmbed.thumbnail.url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.thumbnail.url);
        if (cleanedUrl) {
          validatedEmbed.thumbnail.url = cleanedUrl;
        } else {
          delete validatedEmbed.thumbnail;
        }
      }
      
      if (validatedEmbed.author && validatedEmbed.author.icon_url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.author.icon_url);
        if (cleanedUrl) {
          validatedEmbed.author.icon_url = cleanedUrl;
        } else {
          delete validatedEmbed.author.icon_url;
        }
      }
      
      if (validatedEmbed.footer && validatedEmbed.footer.icon_url) {
        const cleanedUrl = validateAndCleanUrl(validatedEmbed.footer.icon_url);
        if (cleanedUrl) {
          validatedEmbed.footer.icon_url = cleanedUrl;
        } else {
          delete validatedEmbed.footer.icon_url;
        }
      }
      
      return validatedEmbed;
    });
    
    console.log('📤 Отправка правил в Discord (все в одном сообщении):', validatedEmbeds.length, 'embeds');
    
    // Отправляем ВСЕ embeds в ОДНОМ сообщении для правильного выравнивания
    const sentMessage = await channel.send({ embeds: validatedEmbeds });
    
    res.json({ 
      success: true, 
      message: 'Правила успешно отправлены!',
      messageId: sentMessage.id,
      channelId: channelId
    });
  } catch (error) {
    console.error('Ошибка отправки правил:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка отправки правил' 
    });
  }
});

// API для редактирования сообщения
app.post('/api/edit-message', async (req, res) => {
  const { channelId, messageId, embed } = req.body;
  
  if (!channelId || !messageId || !embed) {
    return res.status(400).json({ 
      success: false, 
      message: 'Не указан канал, ID сообщения или данные embed' 
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
    
    // Получаем сообщение
    const message = await channel.messages.fetch(messageId);
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Сообщение не найдено' 
      });
    }
    
    // Функция для валидации и кодирования URL
    function validateAndCleanUrl(url) {
      if (!url || typeof url !== 'string') return null;
      
      url = url.trim();
      
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          console.warn('Невалидный протокол URL:', url);
          return null;
        }
        urlObj.pathname = encodeURI(urlObj.pathname);
        return urlObj.toString();
      } catch (error) {
        try {
          return encodeURI(url);
        } catch {
          console.warn('Невалидный URL:', url, error.message);
          return null;
        }
      }
    }
    
    // Валидируем и очищаем URL изображений перед редактированием
    if (embed.image && embed.image.url) {
      const cleanedUrl = validateAndCleanUrl(embed.image.url);
      if (cleanedUrl) {
        embed.image.url = cleanedUrl;
      } else {
        delete embed.image;
      }
    }
    
    if (embed.thumbnail && embed.thumbnail.url) {
      const cleanedUrl = validateAndCleanUrl(embed.thumbnail.url);
      if (cleanedUrl) {
        embed.thumbnail.url = cleanedUrl;
      } else {
        delete embed.thumbnail;
      }
    }
    
    if (embed.author && embed.author.icon_url) {
      const cleanedUrl = validateAndCleanUrl(embed.author.icon_url);
      if (cleanedUrl) {
        embed.author.icon_url = cleanedUrl;
      } else {
        delete embed.author.icon_url;
      }
    }
    
    if (embed.footer && embed.footer.icon_url) {
      const cleanedUrl = validateAndCleanUrl(embed.footer.icon_url);
      if (cleanedUrl) {
        embed.footer.icon_url = cleanedUrl;
      } else {
        delete embed.footer.icon_url;
      }
    }
    
    console.log('✏️ Редактирование сообщения в Discord:', messageId);
    
    // Редактируем сообщение
    await message.edit({ embeds: [embed] });
    
    res.json({ 
      success: true, 
      message: 'Сообщение успешно отредактировано!',
      messageId: messageId
    });
  } catch (error) {
    console.error('Ошибка редактирования сообщения:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка редактирования сообщения' 
    });
  }
});

// API для удаления сообщения
app.post('/api/delete-message', async (req, res) => {
  const { channelId, messageId } = req.body;
  
  if (!channelId || !messageId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Не указан канал или ID сообщения' 
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
    
    // Получаем сообщение
    const message = await channel.messages.fetch(messageId);
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Сообщение не найдено' 
      });
    }
    
    console.log('🗑️ Удаление сообщения в Discord:', messageId);
    
    // Удаляем сообщение
    await message.delete();
    
    res.json({ 
      success: true, 
      message: 'Сообщение успешно удалено!',
      messageId: messageId
    });
  } catch (error) {
    console.error('Ошибка удаления сообщения:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка удаления сообщения' 
    });
  }
});

// API для получения статистики
app.get('/api/statistics', async (req, res) => {
  try {
    const period = parseInt(req.query.period) || 7;
    const client = require('../bot/client');
    
    if (!client || !client.isReady()) {
      return res.status(503).json({ 
        success: false, 
        message: 'Бот не подключен к Discord' 
      });
    }
    
    // Получаем все серверы
    const guilds = Array.from(client.guilds.cache.values());
    let totalMembers = 0;
    let newMessages = 0;
    let joined = 0;
    let left = 0;
    
    // Генерируем даты за период
    const dates = [];
    const now = new Date();
    for (let i = period - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // Считаем статистику по всем серверам
    for (const guild of guilds) {
      totalMembers += guild.memberCount;
      
      // Здесь можно добавить логику подсчета сообщений, присоединений/выходов
      // Пока возвращаем базовую статистику
    }
    
    // Генерируем тестовые данные для графиков
    const joinedData = dates.map(() => Math.floor(Math.random() * 5));
    const leftData = dates.map(() => Math.floor(Math.random() * 3));
    const totalMembersData = dates.map(() => totalMembers + Math.floor(Math.random() * 10) - 5);
    const messagesData = dates.map(() => Math.floor(Math.random() * 10));
    
    res.json({
      success: true,
      stats: {
        newMessages: newMessages || Math.floor(Math.random() * 10),
        joined: joined || Math.floor(Math.random() * 5),
        left: left || Math.floor(Math.random() * 3),
        totalMembers: totalMembers
      },
      charts: {
        dates: dates,
        joined: joinedData,
        left: leftData,
        totalMembers: totalMembersData,
        messages: messagesData
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка получения статистики' 
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`\n✅ Веб-панель управления запущена!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard\n`);
});

