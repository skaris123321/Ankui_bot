const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

class StreamTracker {
  constructor(client) {
    this.client = client;
    this.db = client.db;
    this.checkInterval = 60000; // Проверка каждую минуту
    this.activeStreams = new Map(); // Хранит активные стримы: guildId -> Map<channelId, streamData>
    this.isRunning = false;
    this.checkTimer = null;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ StreamTracker уже запущен');
      return;
    }

    this.isRunning = true;
    console.log('✅ StreamTracker запущен');
    
    // Первая проверка сразу
    this.checkAllStreams();
    
    // Затем каждую минуту
    this.checkTimer = setInterval(() => {
      this.checkAllStreams();
    }, this.checkInterval);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    console.log('🛑 StreamTracker остановлен');
  }

  async checkAllStreams() {
    if (!this.client.isReady()) return;

    try {
      // Получаем все серверы бота
      const guilds = this.client.guilds.cache;
      
      for (const guild of guilds.values()) {
        await this.checkGuildStreams(guild.id);
      }
    } catch (error) {
      console.error('❌ Ошибка проверки стримов:', error);
    }
  }

  async checkGuildStreams(guildId) {
    try {
      const settings = this.db.getGuildSettings(guildId);
      
      // Проверяем, включены ли уведомления
      if (!settings || !settings.stream_notifications_enabled) {
        return;
      }

      const channels = settings.stream_notifications_channels || [];
      if (channels.length === 0) {
        return;
      }

      const notificationChannelId = settings.stream_notifications_channel_id;
      if (!notificationChannelId) {
        return;
      }

      // Получаем канал для уведомлений
      const channel = await this.client.channels.fetch(notificationChannelId).catch(() => null);
      if (!channel) {
        return;
      }

      // Инициализируем Map для этого сервера, если его нет
      if (!this.activeStreams.has(guildId)) {
        this.activeStreams.set(guildId, new Map());
      }
      const guildStreams = this.activeStreams.get(guildId);

      // Проверяем каждый канал
      for (const streamChannel of channels) {
        try {
          let streamData = null;

          if (streamChannel.platform === 'twitch') {
            streamData = await this.checkTwitchStream(streamChannel.name);
          } else if (streamChannel.platform === 'youtube') {
            streamData = await this.checkYouTubeStream(streamChannel.name);
          }

          if (streamData) {
            const streamKey = `${streamChannel.platform}:${streamChannel.name}`;
            const previousStream = guildStreams.get(streamKey);

            // Если стрим новый (не было в предыдущей проверке)
            if (!previousStream) {
              // Это новый стрим - отправляем уведомление только один раз
              console.log(`📺 Новый стрим обнаружен: ${streamData.user} на ${streamChannel.platform}`);
              
              // Получаем сообщение для этого канала или используем общее
              const channelMessage = streamChannel.message || settings.stream_notifications_message || '@here {user} начал стрим!';
              
              // Отправляем уведомление
              await this.sendNotification(guildId, channel, streamData, settings, channelMessage);
              
              // Сохраняем информацию о стриме с флагом, что уведомление отправлено
              guildStreams.set(streamKey, {
                ...streamData,
                notified: true, // Флаг, что уведомление уже отправлено
                startTime: Date.now()
              });
            } else {
              // Стрим продолжается, просто обновляем данные (зрителей и т.д.), но НЕ отправляем уведомление
              guildStreams.set(streamKey, {
                ...previousStream,
                ...streamData,
                notified: true, // Сохраняем флаг
                startTime: previousStream.startTime // Сохраняем время начала
              });
            }
          } else {
            // Стрим закончился
            const streamKey = `${streamChannel.platform}:${streamChannel.name}`;
            const previousStream = guildStreams.get(streamKey);
            
            if (previousStream && previousStream.notified) {
              console.log(`🔴 Стрим закончился: ${previousStream.user} на ${streamChannel.platform}`);
              guildStreams.delete(streamKey);
            }
          }
        } catch (error) {
          console.error(`❌ Ошибка проверки канала ${streamChannel.name} (${streamChannel.platform}):`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ Ошибка проверки стримов для сервера ${guildId}:`, error);
    }
  }

  async checkTwitchStream(channelName) {
    try {
      // Метод 1: Twitch Helix API (требует Client ID, но более надежный)
      const clientId = process.env.TWITCH_CLIENT_ID;
      
      if (clientId && clientId !== 'your_client_id' && clientId !== 'your_twitch_client_id') {
        try {
          const response = await axios.get(`https://api.twitch.tv/helix/streams`, {
            params: {
              user_login: channelName.toLowerCase()
            },
            headers: {
              'Client-ID': clientId,
              'Accept': 'application/vnd.twitchtv.v5+json'
            },
            timeout: 5000
          });

          if (response.data.data && response.data.data.length > 0) {
            const stream = response.data.data[0];
            return {
              id: stream.id,
              user: stream.user_name,
              title: stream.title,
              game: stream.game_name || 'Unknown',
              viewers: stream.viewer_count,
              thumbnail: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
              url: `https://www.twitch.tv/${stream.user_name}`,
              platform: 'twitch'
            };
          }
        } catch (helixError) {
          // Если Helix API не работает, переходим к альтернативному методу
          console.warn(`⚠️ Twitch Helix API недоступен для ${channelName}, используем альтернативный метод`);
        }
      }
      
      // Метод 2: Альтернативный метод БЕЗ API ключа (работает всегда!)
      // Используем публичные API endpoints
      try {
        // Проверяем, идет ли стрим
        const uptimeResponse = await axios.get(`https://decapi.me/twitch/uptime/${channelName}`, {
          timeout: 8000
        });
        
        const uptime = uptimeResponse.data?.toString().trim() || '';
        
        // Если стрим идет, uptime будет содержать время (например, "2h 30m 15s"), иначе "offline" или пусто
        if (uptime && !uptime.toLowerCase().includes('offline') && uptime !== '' && uptime !== 'null') {
          // Получаем дополнительную информацию о стриме
          const [titleResponse, gameResponse, viewersResponse] = await Promise.allSettled([
            axios.get(`https://decapi.me/twitch/title/${channelName}`, { timeout: 5000 }),
            axios.get(`https://decapi.me/twitch/game/${channelName}`, { timeout: 5000 }),
            axios.get(`https://decapi.me/twitch/viewercount/${channelName}`, { timeout: 5000 })
          ]);
          
          const title = titleResponse.status === 'fulfilled' ? (titleResponse.value.data || 'Live Stream') : 'Live Stream';
          const game = gameResponse.status === 'fulfilled' ? (gameResponse.value.data || 'Unknown') : 'Unknown';
          const viewers = viewersResponse.status === 'fulfilled' ? (parseInt(viewersResponse.value.data) || 0) : 0;
          
          // Генерируем стабильный ID на основе канала (не меняется во время стрима)
          // Используем timestamp начала стрима, если можем его определить
          const streamId = `twitch_${channelName}_live`;
          
          return {
            id: streamId,
            user: channelName,
            title: title,
            game: game,
            viewers: viewers,
            thumbnail: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelName.toLowerCase()}-1280x720.jpg`,
            url: `https://www.twitch.tv/${channelName}`,
            platform: 'twitch'
          };
        }
      } catch (altError) {
        console.warn(`⚠️ Альтернативный метод Twitch для ${channelName} не сработал:`, altError.message);
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Ошибка проверки Twitch стрима ${channelName}:`, error.message);
      return null;
    }
  }

  async checkYouTubeStream(channelIdOrName) {
    try {
      // YouTube Data API v3
      const apiKey = process.env.YOUTUBE_API_KEY || 'your_api_key';
      
      // Сначала получаем channel ID, если передан username
      let channelId = channelIdOrName;
      if (!channelId.startsWith('UC')) {
        // Это username, нужно получить channel ID
        const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: channelIdOrName,
            type: 'channel',
            maxResults: 1,
            key: apiKey
          },
          timeout: 5000
        });

        if (searchResponse.data.items && searchResponse.data.items.length > 0) {
          channelId = searchResponse.data.items[0].id.channelId;
        } else {
          return null;
        }
      }

      // Проверяем активные трансляции
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          channelId: channelId,
          type: 'video',
          eventType: 'live',
          maxResults: 1,
          key: apiKey
        },
        timeout: 5000
      });

      if (response.data.items && response.data.items.length > 0) {
        const video = response.data.items[0];
        
        // Получаем детали видео
        const videoResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            part: 'snippet,liveStreamingDetails,statistics',
            id: video.id.videoId,
            key: apiKey
          },
          timeout: 5000
        });

        if (videoResponse.data.items && videoResponse.data.items.length > 0) {
          const videoData = videoResponse.data.items[0];
          return {
            id: video.id.videoId,
            user: videoData.snippet.channelTitle,
            title: videoData.snippet.title,
            game: videoData.snippet.categoryId || 'Unknown',
            viewers: videoData.liveStreamingDetails?.concurrentViewers || 0,
            thumbnail: videoData.snippet.thumbnails?.maxres?.url || videoData.snippet.thumbnails?.high?.url || '',
            url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            platform: 'youtube'
          };
        }
      }
      return null;
    } catch (error) {
      if (error.response?.status === 403) {
        console.warn(`⚠️ YouTube API требует API ключ для ${channelIdOrName}`);
      }
      return null;
    }
  }


  async sendNotification(guildId, channel, streamData, settings, customMessage = null) {
    try {
      // Формируем сообщение (используем кастомное сообщение для канала или общее)
      let message = customMessage || settings.stream_notifications_message || '@here {user} начал стрим!';
      message = message
        .replace(/{user}/g, streamData.user)
        .replace(/{title}/g, streamData.title)
        .replace(/{game}/g, streamData.game)
        .replace(/{viewers}/g, streamData.viewers.toString())
        .replace(/{platform}/g, streamData.platform === 'twitch' ? 'Twitch' : 'YouTube');

      // Создаем embed
      const embedColor = settings.stream_notifications_embed_color || '#9146FF';
      const embed = new EmbedBuilder()
        .setTitle(`${streamData.user} ${streamData.platform === 'twitch' ? 'стримит на Twitch!' : 'транслирует на YouTube!'}`)
        .setDescription(streamData.title)
        .setColor(embedColor)
        .setImage(streamData.thumbnail)
        .addFields(
          { name: '🎮 Игра', value: streamData.game || 'Unknown', inline: true },
          { name: '👁️ Зрителей', value: streamData.viewers.toString(), inline: true },
          { name: '🔗 Ссылка', value: `[Смотреть стрим](${streamData.url})`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: streamData.platform === 'twitch' ? 'Twitch' : 'YouTube' });

      await channel.send({
        content: message,
        embeds: [embed]
      });

      console.log(`✅ Уведомление отправлено для ${streamData.user} на сервере ${guildId}`);
    } catch (error) {
      console.error(`❌ Ошибка отправки уведомления:`, error);
    }
  }

}

module.exports = StreamTracker;

