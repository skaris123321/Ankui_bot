const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Создать красивое оформленное сообщение')
    .addStringOption(option =>
      option.setName('заголовок')
        .setDescription('Заголовок сообщения')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('текст')
        .setDescription('Основной текст сообщения')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('цвет')
        .setDescription('Цвет сообщения')
        .setRequired(false)
        .addChoices(
          { name: '🔵 Синий', value: '#0099ff' },
          { name: '🟢 Зелёный', value: '#00ff00' },
          { name: '🔴 Красный', value: '#ff0000' },
          { name: '🟡 Жёлтый', value: '#ffff00' },
          { name: '🟣 Фиолетовый', value: '#9b59b6' },
          { name: '🟠 Оранжевый', value: '#e67e22' },
          { name: '⚪ Белый', value: '#ffffff' },
          { name: '⚫ Чёрный', value: '#000000' }
        ))
    .addStringOption(option =>
      option.setName('картинка')
        .setDescription('URL картинки')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('миниатюра')
        .setDescription('URL миниатюры (маленькая картинка справа)')
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('канал')
        .setDescription('Канал, куда отправить сообщение (по умолчанию - текущий)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  
  async execute(interaction) {
    const title = interaction.options.getString('заголовок');
    const description = interaction.options.getString('текст');
    const color = interaction.options.getString('цвет') || '#0099ff';
    const image = interaction.options.getString('картинка');
    const thumbnail = interaction.options.getString('миниатюра');
    const targetChannel = interaction.options.getChannel('канал') || interaction.channel;
    
    try {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ 
          text: `Отправлено ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL()
        });
      
      if (image) {
        embed.setImage(image);
      }
      
      if (thumbnail) {
        embed.setThumbnail(thumbnail);
      }
      
      await targetChannel.send({ embeds: [embed] });
      
      await interaction.reply({ 
        content: `✅ Сообщение отправлено в ${targetChannel}!`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('❌ Ошибка создания embed:', error);
      await interaction.reply({ 
        content: '❌ Произошла ошибка при создании сообщения!', 
        ephemeral: true 
      });
    }
  },
};

