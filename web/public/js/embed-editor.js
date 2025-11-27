let fields = [];

// Обновление предпросмотра
function updatePreview() {
  const preview = document.getElementById('embedPreview');
  if (!preview) return; // Если preview не существует, выходим
  
  const titleEl = document.getElementById('embedTitle');
  const descriptionEl = document.getElementById('embedDescription');
  const colorEl = document.getElementById('embedColor');
  const imageEl = document.getElementById('embedImage');
  const thumbnailEl = document.getElementById('embedThumbnail');
  const authorEl = document.getElementById('embedAuthor');
  const authorIconEl = document.getElementById('embedAuthorIcon');
  const footerEl = document.getElementById('embedFooter');
  const footerIconEl = document.getElementById('embedFooterIcon');
  const timestampEl = document.getElementById('embedTimestamp');
  
  const title = titleEl ? titleEl.value : '';
  const description = descriptionEl ? descriptionEl.value : '';
  const color = colorEl ? colorEl.value : '#0099ff';
  const image = imageEl ? imageEl.value : '';
  const thumbnail = thumbnailEl ? thumbnailEl.value : '';
  const author = authorEl ? authorEl.value : '';
  const authorIcon = authorIconEl ? authorIconEl.value : '';
  const footer = footerEl ? footerEl.value : '';
  const footerIcon = footerIconEl ? footerIconEl.value : '';
  const timestamp = timestampEl ? timestampEl.checked : false;
  
  // Если пусто, показываем сообщение
  if (!title && !description && fields.length === 0) {
    preview.innerHTML = '<div class="empty">Начните вводить данные для предпросмотра...</div>';
    preview.classList.add('empty');
    return;
  }
  
  preview.classList.remove('empty');
  preview.style.borderLeftColor = color;
  
  let html = '';
  
  // Автор
  if (author) {
    html += '<div class="embed-author">';
    if (authorIcon) {
      html += `<img src="${authorIcon}" class="embed-author-icon" onerror="this.style.display='none'">`;
    }
    html += `<span class="embed-author-name">${escapeHtml(author)}</span>`;
    html += '</div>';
  }
  
  // Заголовок
  if (title) {
    html += `<div class="embed-title">${formatMarkdown(escapeHtml(title))}</div>`;
  }
  
  // Описание
  if (description) {
    html += `<div class="embed-description">${formatMarkdown(escapeHtml(description))}</div>`;
  }
  
  // Поля
  if (fields.length > 0) {
    html += '<div class="embed-fields">';
    fields.forEach(field => {
      const inlineClass = field.inline ? 'inline' : 'full';
      html += `<div class="embed-field ${inlineClass}">`;
      html += `<div class="embed-field-name">${formatMarkdown(escapeHtml(field.name))}</div>`;
      html += `<div class="embed-field-value">${formatMarkdown(escapeHtml(field.value))}</div>`;
      html += '</div>';
    });
    html += '</div>';
  }
  
  // Изображение
  if (image) {
    html += `<img src="${image}" class="embed-image" onerror="this.style.display='none'">`;
  }
  
  // Миниатюра
  if (thumbnail) {
    preview.style.position = 'relative';
    html += `<img src="${thumbnail}" class="embed-thumbnail" onerror="this.style.display='none'">`;
  }
  
  // Футер
  if (footer || timestamp) {
    html += '<div class="embed-footer">';
    if (footerIcon) {
      html += `<img src="${footerIcon}" class="embed-footer-icon" onerror="this.style.display='none'">`;
    }
    html += '<span class="embed-footer-text">';
    if (footer) {
      html += escapeHtml(footer);
    }
    if (footer && timestamp) {
      html += ' • ';
    }
    if (timestamp) {
      const now = new Date();
      html += now.toLocaleString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    html += '</span></div>';
  }
  
  preview.innerHTML = html;
}

// Форматирование Markdown
function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Установка цвета
function setColor(hex) {
  const colorEl = document.getElementById('embedColor');
  const colorHexEl = document.getElementById('colorHex');
  if (colorEl) colorEl.value = hex;
  if (colorHexEl) colorHexEl.textContent = hex;
  updatePreview();
}

// Обновление отображения цвета
document.getElementById('embedColor').addEventListener('input', function() {
  document.getElementById('colorHex').textContent = this.value;
  updatePreview();
});

// Добавление поля
function addField() {
  const container = document.getElementById('fieldsContainer');
  if (!container) return; // Если контейнер не существует, выходим
  
  const fieldId = Date.now();
  const fieldHtml = `
    <div class="field-item" id="field-${fieldId}">
      <div class="field-header">
        <h4>Поле ${fields.length + 1}</h4>
        <button class="field-remove-btn" onclick="removeField(${fieldId})">✕ Удалить</button>
      </div>
      <label>Название поля</label>
      <input type="text" class="input-field field-name" data-id="${fieldId}" placeholder="Название" maxlength="256">
      <label>Значение поля</label>
      <textarea class="textarea-field field-value" data-id="${fieldId}" rows="3" placeholder="Значение" maxlength="1024"></textarea>
      <label class="checkbox-label field-inline-label">
        <input type="checkbox" class="field-inline" data-id="${fieldId}">
        <span>В одной строке (inline)</span>
      </label>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', fieldHtml);
  
  fields.push({
    id: fieldId,
    name: '',
    value: '',
    inline: false
  });
  
  // Добавляем обработчики событий
  const nameEl = document.querySelector(`.field-name[data-id="${fieldId}"]`);
  const valueEl = document.querySelector(`.field-value[data-id="${fieldId}"]`);
  const inlineEl = document.querySelector(`.field-inline[data-id="${fieldId}"]`);
  
  if (nameEl) nameEl.addEventListener('input', updateFieldData);
  if (valueEl) valueEl.addEventListener('input', updateFieldData);
  if (inlineEl) inlineEl.addEventListener('change', updateFieldData);
}

// Обновление данных поля
function updateFieldData(e) {
  const fieldId = parseInt(e.target.dataset.id);
  const field = fields.find(f => f.id === fieldId);
  
  if (field) {
    if (e.target.classList.contains('field-name')) {
      field.name = e.target.value;
    } else if (e.target.classList.contains('field-value')) {
      field.value = e.target.value;
    } else if (e.target.classList.contains('field-inline')) {
      field.inline = e.target.checked;
    }
    updatePreview();
  }
}

// Удаление поля
function removeField(fieldId) {
  document.getElementById(`field-${fieldId}`).remove();
  fields = fields.filter(f => f.id !== fieldId);
  updatePreview();
}

// Получение данных embed
function getEmbedData() {
  const titleEl = document.getElementById('embedTitle');
  const descriptionEl = document.getElementById('embedDescription');
  const colorEl = document.getElementById('embedColor');
  const imageEl = document.getElementById('embedImage');
  const thumbnailEl = document.getElementById('embedThumbnail');
  const authorEl = document.getElementById('embedAuthor');
  const authorIconEl = document.getElementById('embedAuthorIcon');
  const footerEl = document.getElementById('embedFooter');
  const footerIconEl = document.getElementById('embedFooterIcon');
  const timestampEl = document.getElementById('embedTimestamp');
  
  // Вспомогательная функция для проверки валидности URL
  function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  // Создаём объект embedData сначала
  const embedData = {
    title: titleEl ? titleEl.value : '',
    description: descriptionEl ? descriptionEl.value : '',
    color: colorEl ? parseInt(colorEl.value.replace('#', ''), 16) : 0x0099ff,
    fields: fields.filter(f => f.name && f.value).map(f => ({
      name: f.name,
      value: f.value,
      inline: f.inline
    })),
    timestamp: (timestampEl && timestampEl.checked) ? new Date().toISOString() : null
  };
  
  // Вспомогательная функция для проверки валидности URL
  function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  // Функция для преобразования URL в абсолютный
  function getAbsoluteUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return null;
    
    // Если уже абсолютный URL (http:// или https://), возвращаем как есть
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Если относительный URL (начинается с /), преобразуем в абсолютный
    if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    
    // Если не начинается с /, но может быть относительным
    try {
      new URL(url); // Проверяем, валидный ли URL
      return url;
    } catch {
      // Если не валидный, пытаемся добавить origin
      return window.location.origin + '/' + url;
    }
  }
  
  // Используем картинку из основного поля или из блоков правил
  // Discord не принимает data URL (base64), только обычные URL
  const image = imageEl ? imageEl.value.trim() : '';
  if (image && !image.startsWith('data:')) {
    const absoluteUrl = getAbsoluteUrl(image);
    if (absoluteUrl && isValidUrl(absoluteUrl)) {
      embedData.image = { url: absoluteUrl };
    }
  } else if (!image) {
    // Проверяем блоки правил на наличие картинки
    if (typeof rulesBlocks !== 'undefined' && rulesBlocks && rulesBlocks.length > 0) {
      const blockWithImage = rulesBlocks.find(b => b.image && !b.image.startsWith('data:'));
      if (blockWithImage && blockWithImage.image) {
        const absoluteUrl = getAbsoluteUrl(blockWithImage.image);
        if (absoluteUrl && isValidUrl(absoluteUrl)) {
          embedData.image = { url: absoluteUrl };
        }
      }
    }
  }
  
  // Используем иконку из основного поля или из блоков правил
  // Discord не принимает data URL (base64), только обычные URL
  const thumbnail = thumbnailEl ? thumbnailEl.value.trim() : '';
  if (thumbnail && !thumbnail.startsWith('data:')) {
    const absoluteUrl = getAbsoluteUrl(thumbnail);
    if (absoluteUrl && isValidUrl(absoluteUrl)) {
      embedData.thumbnail = { url: absoluteUrl };
    }
  } else if (!thumbnail) {
    // Проверяем блоки правил на наличие иконки
    if (typeof rulesBlocks !== 'undefined' && rulesBlocks && rulesBlocks.length > 0) {
      const blockWithIcon = rulesBlocks.find(b => b.icon && !b.icon.startsWith('data:'));
      if (blockWithIcon && blockWithIcon.icon) {
        const absoluteUrl = getAbsoluteUrl(blockWithIcon.icon);
        if (absoluteUrl && isValidUrl(absoluteUrl)) {
          embedData.thumbnail = { url: absoluteUrl };
        }
      }
    }
  }
  
  const author = authorEl ? authorEl.value : '';
  const authorIcon = authorIconEl ? authorIconEl.value : '';
  if (author) {
    embedData.author = { name: author };
    if (authorIcon) embedData.author.icon_url = authorIcon;
  }
  
  const footer = footerEl ? footerEl.value : '';
  const footerIcon = footerIconEl ? footerIconEl.value : '';
  if (footer) {
    embedData.footer = { text: footer };
    if (footerIcon) embedData.footer.icon_url = footerIcon;
  }
  
  return embedData;
}

// Отправка embed в Discord
async function sendEmbed() {
  // Проверяем оба селектора канала (старый и новый из боковой панели)
  const channelEl = document.getElementById('targetChannel');
  const channelSidebarEl = document.getElementById('targetChannelSidebar');
  const channelId = channelSidebarEl ? channelSidebarEl.value : (channelEl ? channelEl.value.trim() : '');
  
  if (!channelId) {
    showMessage('error', '❌ Укажите ID канала!');
    return;
  }
  
  // Проверяем, есть ли блоки правил
  const hasRulesBlocks = typeof rulesBlocks !== 'undefined' && rulesBlocks && rulesBlocks.length > 0;
  
  if (hasRulesBlocks) {
    // Отправляем каждый блок правил как отдельный embed
    const baseEmbedData = getEmbedData();
    const colorEl = document.getElementById('embedColor');
    const baseColor = colorEl ? parseInt(colorEl.value.replace('#', ''), 16) : 0x5865F2;
    
    let successCount = 0;
    let errorCount = 0;
    const warnings = [];
    
    // Функция для проверки валидности URL
    function isValidUrl(url) {
      if (!url || typeof url !== 'string') return false;
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch {
        return false;
      }
    }
    
    // Функция для проверки валидности URL
    function isValidUrl(url) {
      if (!url || typeof url !== 'string') return false;
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch {
        return false;
      }
    }
    
    // Функция для преобразования относительных URL в абсолютные
    function getAbsoluteUrl(url) {
      if (!url || typeof url !== 'string' || url.trim() === '') return null;
      
      // Если уже абсолютный URL (http:// или https://), возвращаем как есть
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // Если относительный URL (начинается с /), преобразуем в абсолютный
      if (url.startsWith('/')) {
        return window.location.origin + url;
      }
      
      // Если не начинается с /, пытаемся добавить origin
      try {
        new URL(url);
        return url;
      } catch {
        return window.location.origin + '/' + url;
      }
    }
    
    for (let i = 0; i < rulesBlocks.length; i++) {
      const block = rulesBlocks[i];
      
      // Формируем описание из правил блока (формат как в Roshan)
      let descriptionText = '';
      if (block.rules && block.rules.length > 0) {
        block.rules.forEach((rule, index) => {
          const ruleNumber = rule.number ? `**Правило - ${rule.number}:**` : '';
          const ruleDescription = rule.description || '';
          const punishmentText = rule.punishment ? ` | Наказание: **${rule.punishment}**` : '';
          const durationText = rule.duration ? ` (Длительность: ${rule.duration})` : '';
          
          if (ruleDescription) {
            // Формат: **Правило - 2.1:** Описание | Наказание: **Варн / Мут**
            descriptionText += `${ruleNumber} ${ruleDescription}${punishmentText}${durationText}`;
            
            // Добавляем пустую строку между правилами, кроме последнего
            if (index < block.rules.length - 1) {
              descriptionText += '\n\n';
            }
          }
        });
      }
      
      // Создаём embed для блока
      const blockEmbed = {
        title: block.title || baseEmbedData.title || 'Правила сервера',
        description: descriptionText.trim() || baseEmbedData.description || '',
        color: baseColor,
        timestamp: baseEmbedData.timestamp
      };
      
      // Если нет описания, но есть картинка или заголовок, всё равно отправляем
      if (!blockEmbed.description && !block.image && !block.title) {
        // Пропускаем пустые блоки
        continue;
      }
      
      // Добавляем картинку (сверху embed)
      // Discord не принимает data URL (base64), только обычные URL (http/https)
      if (block.image) {
        if (block.image.startsWith('data:')) {
          warnings.push(`Блок ${i + 1}: Картинка пропущена (Discord не поддерживает data URL. Используйте загрузку файла)`);
        } else {
          // Преобразуем относительные URL в абсолютные
          const absoluteUrl = getAbsoluteUrl(block.image);
          if (isValidUrl(absoluteUrl)) {
            blockEmbed.image = { url: absoluteUrl };
          } else {
            warnings.push(`Блок ${i + 1}: Неверный URL картинки`);
          }
        }
      } else if (baseEmbedData.image && baseEmbedData.image.url) {
        if (!baseEmbedData.image.url.startsWith('data:')) {
          const absoluteUrl = getAbsoluteUrl(baseEmbedData.image.url);
          if (isValidUrl(absoluteUrl)) {
            blockEmbed.image = { url: absoluteUrl };
          }
        }
      }
      
      // Добавляем иконку (thumbnail)
      // Discord не принимает data URL (base64), только обычные URL (http/https)
      if (block.icon) {
        if (block.icon.startsWith('data:')) {
          warnings.push(`Блок ${i + 1}: Иконка пропущена (Discord не поддерживает data URL. Используйте загрузку файла)`);
        } else {
          // Преобразуем относительные URL в абсолютные
          const absoluteUrl = getAbsoluteUrl(block.icon);
          if (isValidUrl(absoluteUrl)) {
            blockEmbed.thumbnail = { url: absoluteUrl };
          } else {
            warnings.push(`Блок ${i + 1}: Неверный URL иконки`);
          }
        }
      } else if (baseEmbedData.thumbnail && baseEmbedData.thumbnail.url) {
        if (!baseEmbedData.thumbnail.url.startsWith('data:')) {
          const absoluteUrl = getAbsoluteUrl(baseEmbedData.thumbnail.url);
          if (isValidUrl(absoluteUrl)) {
            blockEmbed.thumbnail = { url: absoluteUrl };
          }
        }
      }
      
      // Добавляем автора и футер из базового embed
      if (baseEmbedData.author) {
        blockEmbed.author = baseEmbedData.author;
      }
      if (baseEmbedData.footer) {
        blockEmbed.footer = baseEmbedData.footer;
      }
      
      try {
        const response = await fetch('/api/send-embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channelId: channelId,
            embed: blockEmbed
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Ошибка отправки блока ${i + 1}:`, result.message);
        }
      } catch (error) {
        errorCount++;
        console.error(`Ошибка отправки блока ${i + 1}:`, error);
      }
      
      // Задержка между отправками, чтобы не перегружать Discord API (rate limiting)
      if (i < rulesBlocks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (successCount > 0) {
      showMessage('success', `✅ Отправлено ${successCount} из ${rulesBlocks.length} блоков правил!`);
    }
    if (errorCount > 0) {
      showMessage('error', `❌ Ошибка при отправке ${errorCount} блоков.`);
    }
    if (warnings.length > 0) {
      const warningsText = warnings.join('\n');
      showMessage('warning', `⚠️ Предупреждения:\n${warningsText}`);
    }
    
    return;
  }
  
  // Обычная отправка embed (без блоков правил)
  const embedData = getEmbedData();
  
  if (!embedData.title && !embedData.description) {
    showMessage('error', '❌ Заполните хотя бы заголовок или описание!');
    return;
  }
  
  // Проверяем URL изображений на валидность
  function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  // Функция для преобразования относительных URL в абсолютные
  function getAbsoluteUrl(url) {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    return url;
  }
  
  // Проверяем и преобразуем URL изображений
  if (embedData.image && embedData.image.url) {
    if (embedData.image.url.startsWith('data:')) {
      console.warn('Data URL обнаружен для изображения, пропускаем');
      delete embedData.image;
    } else {
      const absoluteUrl = getAbsoluteUrl(embedData.image.url);
      if (absoluteUrl && isValidUrl(absoluteUrl)) {
        embedData.image.url = absoluteUrl;
        console.log('URL изображения:', absoluteUrl);
      } else {
        console.warn('Невалидный URL изображения, пропускаем:', embedData.image.url);
        delete embedData.image;
      }
    }
  }
  
  if (embedData.thumbnail && embedData.thumbnail.url) {
    if (embedData.thumbnail.url.startsWith('data:')) {
      console.warn('Data URL обнаружен для иконки, пропускаем');
      delete embedData.thumbnail;
    } else {
      const absoluteUrl = getAbsoluteUrl(embedData.thumbnail.url);
      if (absoluteUrl && isValidUrl(absoluteUrl)) {
        embedData.thumbnail.url = absoluteUrl;
        console.log('URL иконки:', absoluteUrl);
      } else {
        console.warn('Невалидный URL иконки, пропускаем:', embedData.thumbnail.url);
        delete embedData.thumbnail;
      }
    }
  }
  
  console.log('Отправка embed:', JSON.stringify(embedData, null, 2));
  
  try {
    const response = await fetch('/api/send-embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: channelId,
        embed: embedData
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showMessage('success', '✅ Сообщение отправлено в Discord!');
    } else {
      showMessage('error', `❌ Ошибка: ${result.message}`);
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', '❌ Не удалось отправить сообщение');
  }
}

// Копирование JSON
function copyJSON() {
  const embedData = getEmbedData();
  const json = JSON.stringify(embedData, null, 2);
  
  navigator.clipboard.writeText(json).then(() => {
    showMessage('success', '✅ JSON скопирован в буфер обмена!');
  }).catch(() => {
    showMessage('error', '❌ Не удалось скопировать');
  });
}

// Показать сообщение
function showMessage(type, text) {
  let messageBox = document.querySelector('.message-box');
  
  if (!messageBox) {
    messageBox = document.createElement('div');
    messageBox.className = 'message-box';
    const actionButtons = document.querySelector('.action-buttons');
    if (actionButtons) {
      actionButtons.appendChild(messageBox);
    } else {
      // Если нет action-buttons, добавляем в конец embed-section
      const embedSection = document.getElementById('embedSection');
      if (embedSection) {
        embedSection.appendChild(messageBox);
      }
    }
  }
  
  messageBox.className = `message-box ${type}`;
  // Используем innerHTML для поддержки многострочных сообщений
  messageBox.innerHTML = text.replace(/\n/g, '<br>');
  messageBox.style.display = 'block';
  
  // Для предупреждений показываем дольше
  const timeout = type === 'warning' ? 8000 : 5000;
  setTimeout(() => {
    messageBox.style.display = 'none';
  }, timeout);
}

// Обработчики событий для всех полей (только если элементы существуют)
const embedTitle = document.getElementById('embedTitle');
const embedDescription = document.getElementById('embedDescription');
const embedColor = document.getElementById('embedColor');
const embedImage = document.getElementById('embedImage');
const embedThumbnail = document.getElementById('embedThumbnail');
const embedAuthor = document.getElementById('embedAuthor');
const embedAuthorIcon = document.getElementById('embedAuthorIcon');
const embedFooter = document.getElementById('embedFooter');
const embedFooterIcon = document.getElementById('embedFooterIcon');
const embedTimestamp = document.getElementById('embedTimestamp');

if (embedTitle) embedTitle.addEventListener('input', updatePreview);
if (embedDescription) embedDescription.addEventListener('input', updatePreview);
if (embedColor) {
  embedColor.addEventListener('input', function() {
    const colorHex = document.getElementById('colorHex');
    if (colorHex) colorHex.textContent = this.value;
    updatePreview();
  });
}
if (embedImage) embedImage.addEventListener('input', updatePreview);
if (embedThumbnail) embedThumbnail.addEventListener('input', updatePreview);
if (embedAuthor) embedAuthor.addEventListener('input', updatePreview);
if (embedAuthorIcon) embedAuthorIcon.addEventListener('input', updatePreview);
if (embedFooter) embedFooter.addEventListener('input', updatePreview);
if (embedFooterIcon) embedFooterIcon.addEventListener('input', updatePreview);
if (embedTimestamp) embedTimestamp.addEventListener('change', updatePreview);

// Начальный предпросмотр (только если preview существует)
if (document.getElementById('embedPreview')) {
  updatePreview();
}

