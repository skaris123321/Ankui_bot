const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Отправить правила сервера')
    .addChannelOption(option =>
      option.setName('канал')
        .setDescription('Канал для правил (по умолчанию - текущий)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client) {
    const targetChannel = interaction.options.getChannel('канал') || interaction.channel;
    const guildId = interaction.guild.id;
    
    // Получаем настройки из базы данных
    const settings = client.db.getGuildSettings(guildId) || {};
    const blocksData = settings.rules_data || [];
    
    try {
      // Если есть блоки правил
      if (blocksData && blocksData.length > 0) {
        // Создаем или получаем webhook для отправки слитных сообщений
        let webhook = null;
        const useWebhook = blocksData.length > 1; // Используем webhook, если больше одного блока
        
        if (useWebhook) {
          const webhooks = await targetChannel.fetchWebhooks();
          webhook = webhooks.find(w => w.name === `${client.user.username} Messages`);
          
          if (!webhook) {
            webhook = await targetChannel.createWebhook({
              name: `${client.user.username} Messages`,
              avatar: client.user.displayAvatarURL(),
              reason: 'Для отправки слитных сообщений без подписи бота'
            });
          }
        }

        // Отправляем каждый блок как отдельный embed
        for (let i = 0; i < blocksData.length; i++) {
          const block = blocksData[i];
          const isFirstBlock = i === 0;
          
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(block.title || `📜 Правила сервера ${interaction.guild.name}`);
          
          // Добавляем footer и timestamp только к первому блоку
          if (isFirstBlock) {
            embed.setTimestamp()
              .setFooter({ 
                text: `Обновлено ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
              });
          }
          
          // Устанавливаем иконку, если указана
          if (block.icon) {
            embed.setThumbnail(block.icon);
          } else if (isFirstBlock) {
            embed.setThumbnail(interaction.guild.iconURL({ dynamic: true }));
          }
          
          // Добавляем изображение, если указано
          if (block.image) {
            embed.setImage(block.image);
          }
          
          // Добавляем правила из блока
          if (block.rules && block.rules.length > 0) {
            block.rules.forEach((rule) => {
              const ruleNumber = rule.number || '';
              const description = rule.description || 'Описание не указано';
              
              let fieldValue = `**${description}**`;
              
              // Добавляем наказание и длительность, если они указаны
              if (rule.punishment || rule.duration) {
                fieldValue += '\n';
                if (rule.punishment) {
                  fieldValue += `\n⚖️ **Наказание:** ${rule.punishment}`;
                }
                if (rule.duration) {
                  fieldValue += `\n⏱️ **Длительность:** ${rule.duration}`;
                }
              }
              
              embed.addFields({
                name: ruleNumber ? `Правило - ${ruleNumber}` : 'Правило',
                value: fieldValue,
                inline: false
              });
            });
          }
          
          // Первый блок отправляем обычным сообщением (с подписью бота)
          // Остальные блоки отправляем через webhook (без подписи, слитные)
          if (isFirstBlock) {
            await targetChannel.send({ embeds: [embed] });
            // Небольшая задержка перед отправкой следующих сообщений
            if (useWebhook) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            // Отправляем через webhook для слитных сообщений
            await webhook.send({
              embeds: [embed],
              username: client.user.username,
              avatarURL: client.user.displayAvatarURL()
            });
            // Небольшая задержка между сообщениями для правильного отображения
            if (i < blocksData.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      } else {
        // Если блоков нет, используем старый формат
        const rulesText = settings.rules_text || this.getDefaultRules();
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`📜 Правила сервера ${interaction.guild.name}`)
          .setDescription(rulesText)
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ 
            text: `Обновлено ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL()
          });
        
        await targetChannel.send({ embeds: [embed] });
      }
      
      await interaction.reply({ 
        content: `✅ Правила отправлены в ${targetChannel}!`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('❌ Ошибка отправки правил:', error);
      await interaction.reply({ 
        content: '❌ Произошла ошибка при отправке правил!', 
        ephemeral: true 
      });
    }
  },
  
  getDefaultRules() {
    return `**1. Уважение превыше всего:** Обращайтесь ко всем участникам с уважением. Запрещены оскорбления, угрозы, провокации и любая форма дискриминации.

**2. Запрещены читы и любые нечестные действия:** Любое обсуждение или использование читов, багов или других способов обмана строго запрещено.

**3. Без спама:** Не отправляйте сообщения с избыточным количеством символов, спамом, флудом, рекламой или ненужным контентом.

**4. Соблюдайте правила канала:** Каждый канал имеет своё предназначение — используйте его по назначению. Например, обсуждайте тактики в канале для тактик, а не в общем чате.

**5. Запрещена реклама:** Без предварительного разрешения администратора запрещено размещение рекламы, включая ссылки на другие серверы, продукты, услуги и т.д.

**6. Не обсуждать политику и религию:** Эти темы часто вызывают конфликты и нечестны на нашем сервере.

**7. Запрещено использование нескольких учетных записей:** Один человек — одна учетная запись. Запрещено использование альт-аккаунтов для обхода наказаний или нарушений.

**8. Слушайте модераторов:** Решения модераторов являются окончательными. Если у вас есть жалобы или предложения, обращайтесь к ним в личные сообщения.

**9. Сообщайте о нарушениях:** Если вы заметили нарушение правил, сообщите об этом модераторам или администраторам.`;
  }
};

