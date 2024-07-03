const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');
const logChannelId = process.env.LOGCHANNEL; // Ensure this is defined in your .env

// Define a cooldown duration in milliseconds (30 seconds)
const cooldownDuration = 30 * 1000;

// Command lock object to track users in a game
const commandLocks = {};

class CardDeck {
    constructor() {
        this.cards = this.createDeck();
    }

    createDeck() {
        const suits = ['♠️', '♥️', '♦️', '♣️'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const values = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 10, 'Q': 10, 'K': 10, 'A': 1
        };

        let deck = [];
        for (let suit of suits) {
            for (let rank of ranks) {
                deck.push({ suit, rank, value: values[rank], emoji: this.getEmoji(rank, suit) });
            }
        }
        return deck;
    }

    getEmoji(rank, suit) {
        return `${rank}${suit}`;
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bjgamble')
        .setDescription('Play a game of blackjack')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('The amount of coins to bet')
                .setRequired(true)),

    run: async ({ interaction }) => {
        if (!interaction.inGuild()) {
            return await interaction.reply({
                content: 'This command can only be executed inside a server.',
                ephemeral: true
            });
        }

        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('bet');

        if (betAmount < 300) {
            return await interaction.reply('Minimum bet amount is 300 coins.');
        }

        // Check if the user is already in a command lock (engaged in another game)
        if (commandLocks[userId]) {
            return await interaction.reply({
                content: 'You are already engaged in another game of blackjack. Please finish that first.',
                ephemeral: true
            });
        }

        // Set the command lock for this user
        commandLocks[userId] = true;

        await interaction.deferReply();

        try {
            let userProfile = await UserProfile.findOne({ userId });

            if (!userProfile || userProfile.balance < betAmount) {
                // Release the command lock before replying with insufficient balance message
                commandLocks[userId] = false;
                return await interaction.editReply('You do not have enough coins to place this bet.');
            }

            const oldBalance = userProfile.balance;

            // Check if the cooldown period has passed
            const now = new Date();
            const lastBlackjackGame = userProfile.lastBlackjackGame || new Date(0);
            const timeSinceLastGame = now - lastBlackjackGame;

            if (timeSinceLastGame < cooldownDuration) {
                const remainingCooldown = cooldownDuration - timeSinceLastGame;
                const remainingCooldownSeconds = Math.ceil(remainingCooldown / 1000);

                // Cooldown embed
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('Cooldown')
                    .setDescription(`You must wait ${remainingCooldownSeconds} seconds before playing another game.`)
                    .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [cooldownEmbed] });

                // Release the command lock
                commandLocks[userId] = false;

                return;
            }


            // Update lastBlackjackGame timestamp to now
            userProfile.lastBlackjackGame = now;
            await userProfile.save();

            // Initialize the card deck for the game
            const deck = new CardDeck();
            deck.shuffle();

            // Deal initial cards for player and dealer
            const playerCards = [deck.draw(), deck.draw()];
            const dealerCards = [deck.draw(), deck.draw()];

            // Function to calculate the total points of a hand
            const calculatePoints = (cards) => {
                let totalPoints = 0;
                let aceCount = 0;

                for (const card of cards) {
                    if (card.rank === 'A') {
                        aceCount++;
                    }
                    totalPoints += card.value;
                }

                // Adjust for Aces being 1 or 11 based on total points
                while (aceCount > 0 && totalPoints <= 11) {
                    totalPoints += 10; // Treat Ace as 11 instead of 1
                    aceCount--;
                }

                return totalPoints;
            };

            // Function to format card display
            const formatCardsDisplay = (cards, hideFirstCard) => {
                return cards.map((card, index) => (hideFirstCard && index === 1 ? '❓❓❓' : `${card.emoji} ${card.rank}`)).join('\n');
            };

            let playerPoints = calculatePoints(playerCards);
            let dealerPoints = calculatePoints(dealerCards);

            // Function to check if hand is blackjack (Ace + 10-value card)
            const isBlackjack = (cards) => {
                return cards.length === 2 && calculatePoints(cards) === 21;
            };

            // Check for player blackjack
            if (isBlackjack(playerCards)) {
                const winAmount = Math.floor(betAmount * 1.2);
                userProfile.balance += winAmount; // Win 1.2x bet
                await userProfile.save();

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Blackjack!')
                    .setDescription(`You got a Blackjack! You win ${winAmount} coins <:Coin:1255306017084936212>.`)
                    .addFields(
                        { name: 'Your Cards', value: formatCardsDisplay(playerCards, false) },
                        { name: 'Dealer Cards', value: formatCardsDisplay(dealerCards, false) }
                    )
                    .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Log the balance update
                await logBalanceUpdate(interaction, oldBalance, userProfile.balance, 'win', betAmount);

                // Release the command lock
                commandLocks[userId] = false;

                return;
            }

            // Build initial embed with player and dealer cards
            const initialEmbed = new EmbedBuilder()
                .setColor('#FFFF00')
                .setTitle('Blackjack')
                .setDescription('Try to get as close to **21** as you can! If you go over, you **bust!**')
                .addFields(
                    { name: 'Your Cards', value: formatCardsDisplay(playerCards, false) },
                    { name: 'Dealer Cards', value: formatCardsDisplay(dealerCards, true) }
                )
                .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('hit')
                        .setLabel('Hit')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stand')
                        .setLabel('Stand')
                        .setStyle(ButtonStyle.Secondary)
                );

            const initialMessage = await interaction.editReply({ embeds: [initialEmbed], components: [row] });

            const filter = (i) => i.user.id === userId;
            const collector = initialMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === 'hit') {
                    // Draw a card for the player
                    const newCard = deck.draw();
                    playerCards.push(newCard);
                    playerPoints = calculatePoints(playerCards);

                    if (playerPoints > 21) {
                        userProfile.balance -= betAmount;
                        await userProfile.save();

                        const bustEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('Bust!')
                            .setDescription('You went over 21. You lose.')
                            .addFields(
                                { name: 'Your Cards', value: formatCardsDisplay(playerCards, false) },
                                { name: 'Dealer Cards', value: formatCardsDisplay(dealerCards, false) }
                            )
                            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                            .setTimestamp();

                        await interaction.editReply({ embeds: [bustEmbed], components: [] });

                        // Log the balance update
                        await logBalanceUpdate(interaction, oldBalance, userProfile.balance, 'lose', betAmount);

                        // Release the command lock
                        commandLocks[userId] = false;

                        return;
                    }

                    // Update the embed with new player cards
                    const updatedEmbed = new EmbedBuilder()
                        .setColor('#FFFF00')
                        .setTitle('Blackjack')
                        .setDescription('Try to get as close to **21** as you can! If you go over, you **bust!**')
                        .addFields(
                            { name: 'Your Cards', value: formatCardsDisplay(playerCards, false) },
                            { name: 'Dealer Cards', value: formatCardsDisplay(dealerCards, true) }
                        )
                        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                        .setTimestamp();

                    await buttonInteraction.update({ embeds: [updatedEmbed], components: [row] });

                    // Release the command lock
                    commandLocks[userId] = false;
                } else if (buttonInteraction.customId === 'stand') {
                    // Player stands, reveal dealer's hidden cards and play dealer's hand
                    dealerPoints = calculatePoints(dealerCards);

                    // Dealer hits until they reach 17 or higher
                    while (dealerPoints < 17) {
                        const newCard = deck.draw();
                        dealerCards.push(newCard);
                        dealerPoints = calculatePoints(dealerCards);
                    }

                    // Determine the winner
                    let resultMessage;
                    let embedColor;
                    let winAmount = 0;

                    if (dealerPoints > 21 || playerPoints > dealerPoints) {
                        winAmount = Math.floor(betAmount * 1.5); // Win 1.5x bet
                        userProfile.balance += winAmount;
                        resultMessage = `You win ${winAmount} coins <:Coin:1255306017084936212>! `;
                        embedColor = '#00FF00';
                    } else if (playerPoints < dealerPoints) {
                        userProfile.balance -= betAmount;
                        resultMessage = 'You lose.';
                        embedColor = '#FF0000';
                    } else {
                        resultMessage = 'It\'s a tie.';
                        embedColor = '#FFFF00';
                    }

                    await userProfile.save();

                    const finalEmbed = new EmbedBuilder()
                        .setColor(embedColor)
                        .setTitle('Game Over')
                        .setDescription(resultMessage)
                        .addFields(
                            { name: 'Your Cards', value: formatCardsDisplay(playerCards, false) },
                            { name: 'Dealer Cards', value: formatCardsDisplay(dealerCards, false) }
                        )
                        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                        .setTimestamp();

                    await buttonInteraction.update({ embeds: [finalEmbed], components: [] });

                    // Log the balance update
                    await logBalanceUpdate(interaction, oldBalance, userProfile.balance, embedColor === '#00FF00' ? 'win' : 'lose', betAmount);

                    // Release the command lock
                    commandLocks[userId] = false;

                    collector.stop();
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Timeout')
                        .setDescription('You took too long to make a decision. Game ended.')
                        .addFields(
                            { name: 'Your Cards', value: formatCardsDisplay(playerCards, false) },
                            { name: 'Dealer Cards', value: formatCardsDisplay(dealerCards, true) }
                        )
                        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] });

                    // Deduct the bet amount from user's balance on timeout only if the game is still active
                    if (userProfile.balance >= betAmount && playerPoints <= 21) {
                        userProfile.balance -= betAmount;
                        await userProfile.save();

                        // Log the balance update
                        await logBalanceUpdate(interaction, oldBalance, userProfile.balance, 'lose', betAmount);
                    }

                    // Release the command lock
                    commandLocks[userId] = false;
                }
            });
            } catch (error) {
                console.error(`Error in blackjack command: ${error}`);
                await interaction.editReply('An error occurred while processing your request.');
                commandLocks[userId] = false; // Ensure command lock is released on error
            }

    },
};

async function logBalanceUpdate(interaction, oldBalance, newBalance, result, betAmount) {
    const logChannel = await interaction.client.channels.fetch(logChannelId);
    if (logChannel && logChannel.isTextBased()) {
        const embedColor = result === 'win' ? '#00FF00' : '#FF0000';
        const logEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle('Balance Update Log')
            .addFields(
                { name: 'User', value: `> ${interaction.user.tag} (${interaction.user.id})` },
                { name: 'Old Balance', value: `> ${oldBalance} coins` },
                { name: 'New Balance', value: `> ${newBalance} coins` },
                { name: 'Result', value: `> ${result === 'win' ? 'Won' : 'Lost'} ${betAmount} coins` },
                { name: 'Command Used', value: '> /bjgamble' }
            )
            .setThumbnail(interaction.user.avatarURL())
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
    }
}
