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
        name: 'staffsubtractitem',
        description: "Manually subtract an item or coins from another user's inventory (Admin only)",
        options: [
            {
                name: 'target-user',
                description: 'The user to subtract the item or coins from',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'item-type',
                description: 'The type of item to subtract (or omit for coins)',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: itemChoices.concat({ name: 'Coins', value: 'coins' }),
            },
            {
                name: 'amount',
                description: 'The amount of the item to subtract (positive) or coins to subtract (negative)',
                type: ApplicationCommandOptionType.Number,
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
        const item = interaction.options.getString('item-type') || 'coins';
        const amount = interaction.options.getNumber('amount');

        if (amount === 0) {
            return interaction.reply('Please specify a valid amount (greater than 0 for items or less than 0 for coins).');
        }

        await interaction.deferReply();

        try {
            let userProfile = await UserProfile.findOne({ userId: targetUserID });

            if (!userProfile) {
                userProfile = new UserProfile({ userId: targetUserID, inventory: {}, balance: 0 });
            }

            if (amount > 0) {
                // Subtract item logic
                if (item === 'coins') {
                    return interaction.editReply('Please specify an item type to subtract.');
                }

                const validItem = itemChoices.find(choice => choice.value === item);
                if (!validItem) {
                    return interaction.editReply('Invalid item specified.');
                }

                if (!userProfile.inventory[item] || userProfile.inventory[item] < amount) {
                    return interaction.editReply(`User does not have enough ${item}(s) to subtract.`);
                }

                userProfile.inventory[item] -= amount;
                if (userProfile.inventory[item] < 0) {
                    userProfile.inventory[item] = 0;
                }

            } else {
                // Subtract coins logic
                const coinsToSubtract = Math.abs(amount);
                if (userProfile.balance < coinsToSubtract) {
                    return interaction.editReply('User does not have enough coins to subtract.');
                }

                userProfile.balance -= coinsToSubtract;
                if (userProfile.balance < 0) {
                    userProfile.balance = 0;
                }
            }

            await userProfile.save();

            const targetUser = await interaction.guild.members.fetch(targetUserID);

            const embedColor = amount > 0 ? '#FF0000' : '#00FF00';
            const actionVerb = amount > 0 ? 'Subtracted' : 'Subtracted';
            const itemType = amount > 0 ? item : 'Coins';
            const actionAmount = Math.abs(amount);

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`Item ${actionVerb}`)
                .setDescription(`Successfully ${actionVerb.toLowerCase()} ${actionAmount} ${itemType}(s) from <@${targetUser.id}>.`)
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
                .addFields(
                    { name: 'Recipient', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Item/Coins', value: `${itemType}`, inline: true },
                    { name: 'Amount', value: `${actionAmount}`, inline: true },
                )
                .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel && logChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`Item ${actionVerb} Log`)
                    .addFields(
                        { name: 'Admin User', value: `${interaction.user.tag} (${interaction.user.id})` },
                        { name: 'Target User', value: `${targetUser.user.tag} (${targetUserID})` },
                        { name: 'Item/Coins', value: `${itemType}`, inline: true },
                        { name: 'Amount', value: `${actionAmount}`, inline: true },
                        { name: 'New Inventory/Coins', value: `${amount > 0 ? `Total ${item}(s) now: ${userProfile.inventory[item]}` : `Total Coins now: ${userProfile.balance}`}` },
                        { name: 'Command Used', value: '/staffsubtractitem' }
                    )
                    .setThumbnail(targetUser.user.avatarURL())
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error(`Error handling /staffsubtractitem: ${error}`);
            await interaction.editReply({
                content: 'There was an error while processing your request.',
                ephemeral: true,
            });
        }
    },
};
