const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Отправить embed сообщение')
    .addChannelOption(option =>
      option.setName('канал')
        .setDescription('Канал для сообщения (по умолчанию - текущий)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client) {
    const targetChannel = interaction.options.getChannel('канал') || interaction.channel;
    const guildId = interaction.guild.id;
    
    // Получаем настройки из базы данных
    const settings = client.db.getGuildSettings(guildId) || {};
    const blocksData = settings.embed_data || [];
    
    try {
      // Если есть блоки embed
      if (blocksData && blocksData.length > 0) {
        const embeds = [];
        
        // Создаем embeds для каждого блока
        for (let i = 0; i < blocksData.length; i++) {
          const block = blocksData[i];
          const isFirstBlock = i === 0;
          
          const embed = new EmbedBuilder();
          
          // Устанавливаем цвет
          if (block.color) {
            embed.setColor(block.color);
          } else {
            embed.setColor('#5865F2');
          }
          
          // Устанавливаем заголовок
          if (block.title) {
            embed.setTitle(block.title);
          }
          
          // Устанавливаем описание
          if (block.description) {
            embed.setDescription(block.description);
          }
          
          // Добавляем footer и timestamp только к первому блоку
          if (isFirstBlock) {
            if (block.timestamp !== false) {
              embed.setTimestamp();
            }
            if (block.footer) {
              embed.setFooter({ 
                text: block.footer.text || '',
                iconURL: block.footer.icon_url || undefined
              });
            }
          }
          
          // Устанавливаем иконку (thumbnail)
          if (block.thumbnail) {
            embed.setThumbnail(block.thumbnail);
          }
          
          // Добавляем изображение
          if (block.image) {
            embed.setImage(block.image);
          }
          
          // Добавляем автора
          if (block.author) {
            embed.setAuthor({
              name: block.author.name || '',
              iconURL: block.author.icon_url || undefined,
              url: block.author.url || undefined
            });
          }
          
          // Добавляем поля (fields)
          if (block.fields && block.fields.length > 0) {
            block.fields.forEach(field => {
              if (field.name && field.value) {
                embed.addFields({
                  name: field.name,
                  value: field.value,
                  inline: field.inline || false
                });
              }
            });
          }
          
          embeds.push(embed);
        }
        
        // Отправляем ВСЕ embeds в ОДНОМ сообщении
        await targetChannel.send({ embeds: embeds });
      } else {
        await interaction.reply({ 
          content: '❌ Нет сохраненных embed сообщений. Создайте их через веб-панель!', 
          ephemeral: true 
        });
        return;
      }
      
      await interaction.reply({ 
        content: `✅ Embed сообщение отправлено в ${targetChannel}!`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('❌ Ошибка отправки embed:', error);
      await interaction.reply({ 
        content: '❌ Произошла ошибка при отправке сообщения!', 
        ephemeral: true 
      });
    }
  },
};

