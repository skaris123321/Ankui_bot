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
  
  // Используем картинку из основного поля или из блоков правил
  const image = imageEl ? imageEl.value : '';
  if (image) {
    embedData.image = { url: image };
  } else {
    // Проверяем блоки правил на наличие картинки
    if (typeof rulesBlocks !== 'undefined' && rulesBlocks && rulesBlocks.length > 0) {
      const blockWithImage = rulesBlocks.find(b => b.image);
      if (blockWithImage && blockWithImage.image) {
        embedData.image = { url: blockWithImage.image };
      }
    }
  }
  
  // Используем иконку из основного поля или из блоков правил
  const thumbnail = thumbnailEl ? thumbnailEl.value : '';
  if (thumbnail) {
    embedData.thumbnail = { url: thumbnail };
  } else {
    // Проверяем блоки правил на наличие иконки
    if (typeof rulesBlocks !== 'undefined' && rulesBlocks && rulesBlocks.length > 0) {
      const blockWithIcon = rulesBlocks.find(b => b.icon);
      if (blockWithIcon && blockWithIcon.icon) {
        embedData.thumbnail = { url: blockWithIcon.icon };
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
  const channelEl = document.getElementById('targetChannel');
  const channelId = channelEl ? channelEl.value.trim() : '';
  
  if (!channelId) {
    showMessage('error', '❌ Укажите ID канала!');
    return;
  }
  
  const embedData = getEmbedData();
  
  if (!embedData.title && !embedData.description) {
    showMessage('error', '❌ Заполните хотя бы заголовок или описание!');
    return;
  }
  
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
    document.querySelector('.action-buttons').appendChild(messageBox);
  }
  
  messageBox.className = `message-box ${type}`;
  messageBox.textContent = text;
  messageBox.style.display = 'block';
  
  setTimeout(() => {
    messageBox.style.display = 'none';
  }, 5000);
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

