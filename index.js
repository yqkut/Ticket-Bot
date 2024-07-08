const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');
config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

client.once('ready', () => {
  console.log(`${client.user.tag} is ready dude lmfao`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!setup') {
    const setupRoleID = process.env.SETUP_ROLE_ID;

    if (!message.member.roles.cache.has(setupRoleID)) {
      return message.reply('You are not authorized to use this command!');
    }

    const ticketEmbed = new EmbedBuilder()
      .setTitle('Choose an option to continue')
      .setDescription('To report any problem or issue, you can press the button and get support from our staffs.\n\nPlease do not open a new channel while you have an existing support channel.')
      .setColor(0x00ff00)
      .setThumbnail(message.guild.iconURL());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('🔓 Create Ticket')
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [ticketEmbed], components: [row] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'create_ticket') {
    const existingTicketChannel = interaction.guild.channels.cache.find(channel =>
      channel.name.startsWith('ticket-') && channel.permissionsFor(interaction.user).has(PermissionsBitField.Flags.ViewChannel)
    );

    if (existingTicketChannel) {
      const existingTicketEmbed = new EmbedBuilder()
        .setTitle('Existing Ticket Found')
        .setDescription(`You already have an open ticket: <#${existingTicketChannel.id}>. Please use the existing channel for your support requests.`)
        .setColor(0xff0000);

      await interaction.reply({ embeds: [existingTicketEmbed], ephemeral: true });
      return;
    }

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_ticket_reason')
        .setPlaceholder('Choose a reason:')
        .addOptions([
          {
            label: 'Support',
            description: 'Ask for help',
            value: 'help',
            emoji: '🙋‍♂️',
          },
          {
            label: 'Technical Support',
            description: 'Ask for technical help',
            value: 'technical_help',
            emoji: '🛠️',
          },
          {
            label: 'Report',
            description: 'Report any user',
            value: 'report',
            emoji: '✉️',
          },
          {
            label: 'Other',
            description: 'Ask for help with other issues',
            value: 'other',
            emoji: '❓',
          },
        ])
    );

    await interaction.reply({
      content: 'What do you need help with?',
      components: [selectMenu],
      ephemeral: true,
    });
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
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        {
          id: process.env.HELPER_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
      ],
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
        reasonText = 'Support';
    }

    const role = interaction.guild.roles.cache.get(process.env.HELPER_ROLE_ID);
    role.members.forEach(async (member) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('🎫 New Ticket Created')
          .setDescription(`A new ticket has been created!`)
          .addFields(
            { name: 'Created by', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reasonText, inline: true },
            { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
          )
          .setColor(0x00ff00)
          .setFooter({
            text: `Please assist them in the channel.`,
            iconURL: interaction.guild.iconURL(),
          });
    
        await member.send({ embeds: [embed] });
      } catch (error) {
        console.error(`Could not send DM to ${member.user.tag}: ${error}`);
      }
    });
    

    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Your ticket was successfully created!')
      .setDescription(
        `**Reason for ticket creation:** ${reasonText}\n\nOur staffs with role <@&${process.env.HELPER_ROLE_ID}> will help you.`
      )
      .setColor(0x00ff00)
      .setFooter({
        text: `Your problem will surely be solved, please wait patiently.`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await ticketChannel.send({
      embeds: [ticketEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🔒 Close Ticket')
            .setStyle(ButtonStyle.Danger)
        ),
      ],
      content: `<@&${process.env.HELPER_ROLE_ID}>`,
    });

    const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
    const creationLogEmbed = new EmbedBuilder()
      .setTitle('Ticket Created')
      .setDescription(`A new ticket has been created.`)
      .addFields(
        { name: 'Created by', value: interaction.user.tag, inline: true },
        { name: 'Reason', value: reasonText, inline: true },
        { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true },
        { name: 'Created at', value: new Date().toLocaleString(), inline: true }
      )
      .setColor(0x00ff00);

    await logChannel.send({ embeds: [creationLogEmbed] });

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('Ticket Opened')
          .setDescription(`Your ticket has been successfully opened, ${interaction.user}! Our staff will assist you shortly.`)
          .setColor(0x00ff00)
          .setFooter({
            text: 'Thank you for your patience.',
            iconURL: interaction.user.displayAvatarURL(),
          })
      ],
      components: [],
      ephemeral: true,
    });
    
  }

  if (interaction.customId === 'close_ticket') {
    if (!interaction.member.roles.cache.has(process.env.HELPER_ROLE_ID)) { 
      const noPermissionEmbed = new EmbedBuilder()
        .setTitle('Permission Denied')
        .setDescription('Only staffs with the required role can close this ticket!')
        .setColor(0xff0000)
        .setFooter({ text: 'Contact an admin if you believe this is a mistake.' });
  
      return interaction.reply({
        embeds: [noPermissionEmbed], 
        ephemeral: true,
      });
    }
  
    const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
  
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const messageArray = messages.map((msg) => `${msg.author.tag}: ${msg.content}`).reverse();
    const logFilePath = path.join(__dirname, `log-${interaction.channel.name}.txt`);
  
    fs.writeFileSync(logFilePath, messageArray.join('\n'), 'utf8');
  
    const logEmbed = new EmbedBuilder()
      .setTitle('Ticket Closed')
      .setDescription(`Ticket \`${interaction.channel.name}\` has been closed.`)
      .addFields(
        { name: 'Closed by', value: interaction.user.tag, inline: true },
        { name: 'Closed at', value: new Date().toLocaleString(), inline: true }
      )
      .setColor(0xff0000);
  
    await logChannel.send({ embeds: [logEmbed] });
    await logChannel.send({ files: [logFilePath] });
  
    fs.unlinkSync(logFilePath);
  
    await interaction.channel.delete();
  }
});

client.login(process.env.DISCORD_TOKEN);
