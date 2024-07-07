const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { config } = require('dotenv');
config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`${client.user.tag} is ready dude lmfao`);
});

client.on('messageCreate', async message => {
  if (message.content === '!setup') {
    const setupRoleID = process.env.SETUP_ROLE_ID;
    
    if (!message.member.roles.cache.has(setupRoleID)) {
      return message.reply('You are not authorized to use this command!');
    }

    const ticketEmbed = {
      title: 'Choose an option to continue',
      description: 'To report any problem or issue, you can press the button and get support from our staffs.\n\nPlease do not open a new channel while you have an existing support channel.',
      color: 0x00ff00
    };

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('🔓 Create Ticket')
          .setStyle(ButtonStyle.Success)
      );

    await message.channel.send({ embeds: [ticketEmbed], components: [row] });
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'create_ticket') {
    const selectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_ticket_reason')
          .setPlaceholder('Choose a reason:')
          .addOptions([
            {
              label: 'Support',
              description: 'Ask for help',
              value: 'help',
              emoji: '🙋‍♂️'
            },
            {
              label: 'Technical Support',
              description: 'Ask for technical help',
              value: 'technical_help',
              emoji: '🛠️'
            },
            {
              label: 'Report',
              description: 'Report any user',
              value: 'report',
              emoji: '✉️'
            },
            {
              label: 'Other',
              description: 'Ask for help with other issues',
              value: 'other',
              emoji: '❓'
            }
          ])
      );

    await interaction.reply({ content: 'What do you need help with?', components: [selectMenu], ephemeral: true });
  }

  if (interaction.customId === 'select_ticket_reason') {
    const reason = interaction.values[0];
    
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0,
      parent: process.env.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: process.env.TICKET_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    let reasonText;
    switch (reason) {
      case 'support':
        reasonText = 'Support';
        break;
      case 'technical_help':
        reasonText = 'Technical Support';
        break;
      case 'report':
        reasonText = 'Report';
        break;
      case 'other':
        reasonText = 'Other';
        break;
      default:
        reasonText = 'Unknown';
    }

    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Your ticket was successfully created!')
      .setDescription(`**Reason for ticket creation:** ${reasonText}\n\nOur staffs with role <@&1259573922022690867> will help you.`)
      .setColor(0x00ff00)
      .setFooter({ text: `Your problem will surely be solved, please wait patiently.`, iconURL: interaction.user.displayAvatarURL() });

    await ticketChannel.send({
      embeds: [ticketEmbed],
      components: [
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('🔒 Close Ticket')
              .setStyle(ButtonStyle.Danger)
          )
      ],
            content: `<@&1259573922022690867>`
    });

    await interaction.update({ content: `Your Ticket is Opened, ${interaction.user}!`, components: [], ephemeral: true });
  }

  if (interaction.customId === 'close_ticket') {
    if (!interaction.member.roles.cache.has(process.env.TICKET_ROLE_ID)) {
      return interaction.reply({ content: 'Only staffs with role <@&1259573922022690867> can close this ticket!', ephemeral: true });
    }
    
    await interaction.channel.delete();
  }
});

client.login(process.env.DISCORD_TOKEN);
