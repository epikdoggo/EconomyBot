const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');

module.exports = {
    run: async ({ interaction }) => {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: "This command can only be executed inside a server.",
                ephemeral: true,
            });
            return;
        }

        const targetUserID = interaction.options.getUser('target-user')?.id || interaction.user.id;
        const isSelf = targetUserID === interaction.user.id;
        await interaction.deferReply();

        try {
            let userProfile = await UserProfile.findOne({ userId: targetUserID });

            if (!userProfile) {
                userProfile = new UserProfile({ userId: targetUserID });
                await userProfile.save();
            }

            if (isSelf) {
                const now = new Date();
                const lastInterestApplied = userProfile.lastInterestApplied || new Date(0);
                const daysSinceLastInterest = Math.floor((now - lastInterestApplied) / (1000 * 60 * 60 * 24));

                if (daysSinceLastInterest > 0) {
                    const interestRate = 0.004;
                    const interestEarned = Math.floor(userProfile.balance * interestRate * daysSinceLastInterest);
                    userProfile.balance += interestEarned;
                    userProfile.lastInterestApplied = now;
                    await userProfile.save();

                    const targetUser = await interaction.guild.members.fetch(targetUserID);

                    const inventory = Object.entries(userProfile.inventory)
                        .filter(([key, value]) => value > 0)
                        .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: **${value}**`);

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('<:Coin:1255306017084936212> Balance <:Coin:1255306017084936212>')
                        .setAuthor({ name: targetUser.user.username, iconURL: targetUser.user.avatarURL() })
                        .setDescription(
                            `Your balance is **${userProfile.balance}** <:Coin:1255306017084936212>.\n\n` +
                            `**Inventory:**\n${inventory.join('\n') || 'You have no items.'}\n\n` +
                            `Interest accrued over ${daysSinceLastInterest} day(s): **${interestEarned}** coins.`
                        )
                        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } else {
                    const targetUser = await interaction.guild.members.fetch(targetUserID);

                    const inventory = Object.entries(userProfile.inventory)
                        .filter(([key, value]) => value > 0)
                        .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: **${value}**`);

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('<:Coin:1255306017084936212> Balance <:Coin:1255306017084936212>')
                        .setAuthor({ name: targetUser.user.username, iconURL: targetUser.user.avatarURL() })
                        .setDescription(
                            `Your balance is **${userProfile.balance}** <:Coin:1255306017084936212>.\n\n` +
                            `**Inventory:**\n${inventory.join('\n') || 'You have no items.'}`
                        )
                        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                }
            } else {
                const targetUser = await interaction.guild.members.fetch(targetUserID);

                const inventory = Object.entries(userProfile.inventory)
                    .filter(([key, value]) => value > 0)
                    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: **${value}**`);

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('<:Coin:1255306017084936212> Balance <:Coin:1255306017084936212>')
                    .setAuthor({ name: targetUser.user.username, iconURL: targetUser.user.avatarURL() })
                    .setDescription(
                        `<@${targetUserID}>'s balance is **${userProfile.balance}** <:Coin:1255306017084936212>.\n\n` +
                        `**Inventory:**\n${inventory.join('\n') || 'This user has no items.'}`
                    )
                    .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(`Error handling /inventory: ${error}`);
            await interaction.editReply({ content: "An error occurred while retrieving the inventory." });
        }
    },

    data: {
        name: 'balance',
        description: "Check your inventory and coin balance.",
        options: [
            {
                name: 'target-user',
                description: "The user whose inventory you want to see.",
                type: ApplicationCommandOptionType.User,
                required: false,
            },
        ],
    },
};
