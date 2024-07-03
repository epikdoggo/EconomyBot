const { EmbedBuilder, ApplicationCommandOptionType, PermissionsBitField } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');
const AUTHORIZED_ROLE = process.env.AUTHORIZEDROLE;
const LOG_CHANNEL_ID = process.env.LOGCHANNEL;

const itemChoices = [
    { name: 'Wood Stack', value: 'woodStack' },
    { name: 'Leaf Stack', value: 'leafStack' },
    { name: 'Coal Stack', value: 'coalStack' },
    { name: 'Stone Stack', value: 'stoneStack' },
    { name: 'Hide Stack', value: 'hideStack' },
    { name: 'Raw Iron Stack', value: 'rawIronStack' },
    { name: 'Raw Bluesteel Stack', value: 'rawBluesteelStack' },
    { name: 'Iron Bar Stack', value: 'ironBarStack' },
    { name: 'Steel Bar Stack', value: 'steelBarStack' },
    { name: 'Darksteel Bar Stack', value: 'darksteelBarStack' },
    { name: 'Bluesteel Bar Stack', value: 'bluesteelBarStack' },
    { name: 'Iron Nail Stack', value: 'ironNailStack' },
    { name: 'Steel Nail Stack', value: 'steelNailStack' },
    { name: 'Bluesteel Nail Stack', value: 'bluesteelNailStack' },
    { name: 'Hearty Stew Stack', value: 'heartyStewStack' },
    { name: 'Whale Stack', value: 'whaleStack' },
    { name: 'Spicy Rib Meal Stack', value: 'spicyRibMealStack' },
    { name: 'Cabbage Stack', value: 'cabbageStack' },
    { name: 'Carrots Stack', value: 'carrotsStack' },
    { name: 'Peppers Stack', value: 'peppersStack' },
    { name: 'Wheat Stack', value: 'wheatStack' },
    { name: 'Bricks Stack', value: 'bricksStack' },
    { name: 'Shingles Stack', value: 'shinglesStack' },
    { name: 'Arrows Stack', value: 'arrowsStack' }
];

module.exports = {
    data: {
        name: 'staffsetitem',
        description: "Manually set an item or balance for another user's account (Admin only)",
        options: [
            {
                name: 'target-user',
                description: 'The user to set the item or balance for',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'item-type',
                description: 'The type of item to set or "coins" for balance',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: itemChoices.concat({ name: 'Coins', value: 'coins' }),
            },
            {
                name: 'amount',
                description: 'The amount of the item or balance to set',
                type: ApplicationCommandOptionType.Integer,
                required: true,
            },
        ],
    },
    run: async ({ interaction, client }) => {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: "This command can only be executed inside a server.",
                ephemeral: true,
            });
            return;
        }

        const member = interaction.member;

        if (!member.permissions.has(PermissionsBitField.Flags.Administrator) &&
            !member.roles.cache.has(AUTHORIZED_ROLE)) {
            await interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true,
            });
            return;
        }

        const targetUserID = interaction.options.getUser('target-user').id;
        const item = interaction.options.getString('item-type');
        const amount = interaction.options.getInteger('amount');

        if (amount < 0) {
            return interaction.reply('Please specify a valid amount greater than or equal to 0.');
        }

        await interaction.deferReply();

        try {
            let userProfile = await UserProfile.findOne({ userId: targetUserID });

            if (!userProfile) {
                userProfile = new UserProfile({ userId: targetUserID, inventory: {} });
            }

            if (item === 'coins') {
                userProfile.balance = amount;
            } else {
                userProfile.inventory[item] = amount;
            }

            await userProfile.save();

            const targetUser = await interaction.guild.members.fetch(targetUserID);

            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('Item or Balance Set')
                .setDescription(`Successfully set ${amount} ${item}(s) for <@${targetUser.id}>.`)
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
                .addFields(
                    { name: 'Recipient', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Item', value: `${item}`, inline: true },
                    { name: 'Amount', value: `${amount}`, inline: true },
                )
                .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel && logChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('Item or Balance Setting Log')
                    .addFields(
                        { name: 'Admin User', value: `${interaction.user.tag} (${interaction.user.id})` },
                        { name: 'Target User', value: `${targetUser.user.tag} (${targetUserID})` },
                        { name: 'Item Set', value: `${item}` },
                        { name: 'Amount', value: `${amount}` },
                        { name: 'New Inventory or Balance', value: `Total ${item}(s) now: ${item === 'coins' ? userProfile.balance : userProfile.inventory[item]}` },
                        { name: 'Command Used', value: '/staffsetitem' }
                    )
                    .setThumbnail(targetUser.user.avatarURL())
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error(`Error handling /staffsetitem: ${error}`);
            await interaction.editReply({
                content: 'There was an error while processing your request.',
                ephemeral: true,
            });
        }
    },
};
