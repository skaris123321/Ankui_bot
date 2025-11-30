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

// Старый endpoint удален - используем новый ниже

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

// API для получения эмодзи сервера
app.get('/api/guild/:guildId/emojis', async (req, res) => {
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
    
    // Получаем эмодзи сервера
    const emojis = Array.from(guild.emojis.cache.values())
      .map(emoji => ({
        id: emoji.id,
        name: emoji.name,
        animated: emoji.animated,
        url: emoji.url,
        identifier: emoji.identifier // формат: name:id для кастомных эмодзи
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({ success: true, emojis });
  } catch (error) {
    console.error('Ошибка получения эмодзи:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка получения эмодзи' 
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
  try {
    const { channelId, embed, embeds, roleButtons, messageIndex } = req.body;
    
    console.log('📥 Получен запрос на отправку embed:', {
      channelId: channelId ? 'указан' : 'не указан',
      hasEmbed: !!embed,
      hasEmbeds: !!embeds,
      embedsCount: embeds ? embeds.length : 0,
      hasRoleButtons: !!roleButtons,
      roleButtonsCount: roleButtons ? roleButtons.length : 0,
      messageIndex: messageIndex
    });
    
    if (!channelId || (!embed && !embeds)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Не указан канал или данные embed' 
      });
    }
    
    // Поддержка как одного embed, так и массива embeds
    const embedsArray = embeds || (embed ? [embed] : []);
    
    if (!embedsArray || embedsArray.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Нет данных для отправки' 
      });
    }
    
    // Получаем клиента бота
    const client = require('../bot/client');
    
    if (!client || !client.isReady()) {
      return res.status(503).json({ 
        success: false, 
        message: 'Бот не подключен к Discord' 
      });
    }
    
    // Получаем канал
    let channel;
    try {
      channel = await client.channels.fetch(channelId);
    } catch (error) {
      console.error('❌ Ошибка получения канала:', error);
      return res.status(404).json({ 
        success: false, 
        message: 'Канал не найден: ' + error.message 
      });
    }
    
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
    
    // Фильтруем полностью пустые embeds (без title, description, image, thumbnail, fields)
    const filteredEmbeds = validatedEmbeds.filter(embed => {
      if (!embed) return false;
      return embed.title || embed.description || embed.image || embed.thumbnail || (embed.fields && embed.fields.length > 0) || embed.author || embed.footer;
    });
    
    // Проверяем, что есть хотя бы один embed
    if (!filteredEmbeds || filteredEmbeds.length === 0) {
      console.error('❌ Все embeds пустые после фильтрации');
      return res.status(400).json({ 
        success: false, 
        message: 'Нет данных для отправки (все embeds пустые)' 
      });
    }
    
    // Используем отфильтрованные embeds
    const validatedEmbedsFinal = filteredEmbeds;
    
    console.log('📤 Отправка embeds в Discord:', validatedEmbedsFinal.length, 'embeds (было:', validatedEmbeds.length, ')');
    if (roleButtons && roleButtons.length > 0) {
      console.log('🔘 Кнопки ролей:', roleButtons.length, 'кнопок');
    }
    
    // Создаем компоненты с кнопками, если они есть
    const components = [];
    
    if (roleButtons && Array.isArray(roleButtons) && roleButtons.length > 0) {
      try {
        // Используем классы из discord.js
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        // Максимум 5 кнопок в одном ряду, максимум 5 рядов
        const maxButtonsPerRow = 5;
        const maxRows = 5;
        let currentRow = new ActionRowBuilder();
        let rowCount = 0;
        
        for (let i = 0; i < roleButtons.length && rowCount < maxRows; i++) {
          const buttonData = roleButtons[i];
          
          // Пропускаем кнопки без roleId или label
          if (!buttonData || !buttonData.roleId || !buttonData.label) {
            console.warn('Пропущена кнопка без roleId или label:', buttonData);
            continue;
          }
          
          if (currentRow.components.length >= maxButtonsPerRow) {
            components.push(currentRow);
            currentRow = new ActionRowBuilder();
            rowCount++;
          }
          
          try {
            const button = new ButtonBuilder()
              .setCustomId(`role_select_${buttonData.roleId}`)
              .setLabel(buttonData.label.substring(0, 80)) // Максимум 80 символов
              .setStyle(ButtonStyle.Primary);
            
            if (buttonData.emoji && buttonData.emoji.trim()) {
              try {
                const emojiStr = buttonData.emoji.trim();
                
                // Если это формат name:id (кастомное эмодзи сервера)
                if (emojiStr.includes(':') && !emojiStr.startsWith('<')) {
                  const parts = emojiStr.split(':');
                  if (parts.length === 2 && parts[1].match(/^\d+$/)) {
                    // Формат: name:id
                    button.setEmoji({
                      id: parts[1],
                      name: parts[0]
                    });
                    console.log('✅ Установлено кастомное эмодзи:', parts[0], parts[1]);
                  } else {
                    // Пытаемся использовать как обычное эмодзи (Unicode)
                    button.setEmoji(emojiStr);
                  }
                } else if (emojiStr.startsWith('<') && emojiStr.endsWith('>')) {
                  // Формат: <:name:id> или <a:name:id>
                  const match = emojiStr.match(/<a?:(\w+):(\d+)>/);
                  if (match) {
                    button.setEmoji({
                      id: match[2],
                      name: match[1],
                      animated: emojiStr.startsWith('<a:')
                    });
                    console.log('✅ Установлено эмодзи из формата Discord:', match[1], match[2]);
                  } else {
                    console.warn('Неверный формат эмодзи:', emojiStr);
                  }
                } else {
                  // Обычное Unicode эмодзи или просто имя (без двоеточий)
                  button.setEmoji(emojiStr);
                  console.log('✅ Установлено Unicode эмодзи:', emojiStr);
                }
              } catch (err) {
                console.warn('Ошибка установки эмодзи для кнопки:', err.message);
                console.warn('Эмодзи:', buttonData.emoji);
                // Продолжаем без эмодзи, если ошибка
              }
            }
            
            currentRow.addComponents(button);
          } catch (err) {
            console.error('Ошибка создания кнопки:', err);
            continue;
          }
        }
        
        if (currentRow.components.length > 0) {
          components.push(currentRow);
        }
        
        console.log('✅ Создано компонентов с кнопками:', components.length);
      } catch (error) {
        console.error('❌ Ошибка создания компонентов кнопок:', error);
        console.error('Stack:', error.stack);
        // Продолжаем без кнопок, если есть ошибка
      }
    }
    
    // Если есть кнопки и указан индекс сообщения, отправляем несколько сообщений
    let sentMessage;
    try {
      if (roleButtons && roleButtons.length > 0 && components.length > 0 && messageIndex !== undefined && messageIndex !== null && !isNaN(messageIndex)) {
        const messageIndexNum = parseInt(messageIndex);
        console.log('🔘 Отправка с кнопками для сообщения с индексом:', messageIndexNum);
        
        // Проверяем, что индекс валидный
        if (messageIndexNum >= 0 && messageIndexNum < validatedEmbedsFinal.length) {
          // Отправляем embeds до выбранного сообщения
          if (messageIndexNum > 0) {
            console.log('📤 Отправка embeds до выбранного:', messageIndexNum);
            await channel.send({ embeds: validatedEmbedsFinal.slice(0, messageIndexNum) });
          }
          
          // Отправляем выбранное сообщение с кнопками
          const targetEmbed = validatedEmbedsFinal[messageIndexNum];
          if (targetEmbed && components.length > 0) {
            console.log('📤 Отправка выбранного сообщения с кнопками');
            sentMessage = await channel.send({ 
              embeds: [targetEmbed],
              components: components
            });
          } else if (targetEmbed) {
            // Если нет компонентов, отправляем без них
            console.log('📤 Отправка выбранного сообщения без кнопок');
            sentMessage = await channel.send({ 
              embeds: [targetEmbed]
            });
          }
          
          // Отправляем остальные embeds
          if (messageIndexNum < validatedEmbedsFinal.length - 1) {
            console.log('📤 Отправка остальных embeds');
            await channel.send({ embeds: validatedEmbedsFinal.slice(messageIndexNum + 1) });
          }
        } else {
          // Если индекс невалидный, отправляем все embeds одним сообщением с кнопками
          console.log('⚠️ Индекс невалидный, отправляем все embeds одним сообщением');
          const messageOptions = { embeds: validatedEmbedsFinal };
          if (components.length > 0) {
            messageOptions.components = components;
          }
          sentMessage = await channel.send(messageOptions);
        }
      } else {
        // Отправляем все embeds одним сообщением (с кнопками в конце, если они есть)
        console.log('📤 Отправка всех embeds одним сообщением');
        const messageOptions = { embeds: validatedEmbedsFinal };
        if (components.length > 0) {
          messageOptions.components = components;
          console.log('✅ Добавлены компоненты с кнопками:', components.length, 'рядов');
        }
        console.log('📤 Параметры отправки:', {
          embedsCount: validatedEmbeds.length,
          hasComponents: components.length > 0
        });
        sentMessage = await channel.send(messageOptions);
        console.log('✅ Сообщение отправлено, ID:', sentMessage.id);
      }
    } catch (sendError) {
      console.error('❌ Ошибка отправки сообщения в Discord:', sendError);
      console.error('Stack:', sendError.stack);
      console.error('Данные embeds:', JSON.stringify(validatedEmbeds.slice(0, 1), null, 2)); // Первый embed для отладки
      console.error('Компоненты:', components.length);
      throw sendError; // Пробрасываем ошибку дальше
    }
    
    // Сохраняем информацию о кнопках в базу данных, если они есть
    if (roleButtons && roleButtons.length > 0 && sentMessage) {
      const guildId = channel.guild.id;
      const currentSettings = db.getGuildSettings(guildId) || {};
      const roleButtonsData = currentSettings.role_buttons || {};
      
      roleButtonsData[sentMessage.id] = {
        roles: roleButtons,
        messageIndex: messageIndex || 0
      };
      
      db.setGuildSettings(guildId, {
        ...currentSettings,
        role_buttons: roleButtonsData
      });
      
      console.log('💾 Сохранены кнопки ролей для сообщения', sentMessage.id);
    }
    
    if (!sentMessage) {
      return res.status(500).json({ 
        success: false, 
        message: 'Не удалось отправить сообщение' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Сообщение успешно отправлено!',
      messageId: sentMessage.id,
      channelId: channelId
    });
  } catch (error) {
    console.error('❌ Ошибка отправки embed:', error);
    console.error('Stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка отправки сообщения',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API для сохранения embed блоков в базу данных
app.post('/api/guild/:guildId/embed-data', (req, res) => {
  const { guildId } = req.params;
  const { embed_data, embed_image_block } = req.body;
  
  try {
    // Получаем текущие настройки
    const currentSettings = db.getGuildSettings(guildId) || {};
    
    // Обновляем embed_data и embed_image_block
    const updatedSettings = {
      ...currentSettings,
      embed_data: embed_data || []
    };
    
    // Сохраняем первый блок с картинкой, если он есть
    if (embed_image_block) {
      updatedSettings.embed_image_block = embed_image_block;
    }
    
    db.setGuildSettings(guildId, updatedSettings);
    
    console.log('💾 Сохранены embed блоки для сервера', guildId);
    
    res.json({ 
      success: true, 
      message: 'Embed блоки успешно сохранены!' 
    });
  } catch (error) {
    console.error('Ошибка сохранения embed блоков:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Ошибка сохранения embed блоков' 
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

