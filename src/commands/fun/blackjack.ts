import { Command } from '@lib/types/Command';
import { ChatInputCommandInteraction,
	InteractionResponse,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ButtonInteraction,
	ComponentType }
	from 'discord.js';

export default class extends Command {

	description = 'Challenge Sage to a round of Black Jack!';
	extendedHelp = 'Get a higher score than Sage, but do not exceed 21!';

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];
		let playerHand = 0;
		playerHand = deck[Math.floor(Math.random() * 10) + 1] + deck[Math.floor(Math.random() * 10) + 1];
		const dealerHand = 7;
		let drawnCard = 0;
		let gameStatus = "Click 'Hit' to draw or 'Stand' to pass";
		let gameOver = false;

		// Creates game window/embed
		const createGameEmbed = (player: number, dealer: number, status: string) => {
			const embed = new EmbedBuilder()
				// Sets attributes for the game embed
				.setColor('#0099FF')
				.setTitle('Blackjack 🃏')
				.addFields(
					// Creates a field for the dealer's hand
					{ name: "Dealer's Hand", value: `**${dealer}**`, inline: true },
					// Creates a field for the player's hand
					{ name: `${interaction.user.username}'s Hand`, value: `**${player}**`, inline: true }
				)
				.setFooter({ text: status });

			if (gameOver) {
				embed.setColor('Red');
			} else {
				embed.setColor('Blue');
			}
			return embed;
		};

		// Creates the buttons "Hit", "Stand", and "Rules"
		const hitButton = new ButtonBuilder()
			.setCustomId('blackjack_hit')
			.setLabel('Hit')
			.setStyle(ButtonStyle.Success); // .Success = Green button

		const standButton = new ButtonBuilder()
			.setCustomId('blackjack_stand')
			.setLabel('Stand')
			.setStyle(ButtonStyle.Danger); // .Danger = Red button

		const rulesButton = new ButtonBuilder()
			.setCustomId('blackjack-rules')
			.setLabel('Rules')
			.setStyle(ButtonStyle.Primary); // .Primary = Blue button

		// Puts the "Hit" and "Stand" buttons into a row
		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(hitButton, standButton, rulesButton);

		// Sage replies with the game's embed and buttons
		const response = await interaction.reply({
			embeds: [createGameEmbed(playerHand, dealerHand, gameStatus)],
			components: [row],
			fetchReply: true
		});

		// Only the user who started the command can interact with the buttons
		const filter = (i: ButtonInteraction) => i.user.id === interaction.user.id;

		// "Listens" for clicks on the buttons
		const collector = response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: filter,
			time: 60000 // You have 1 minute before the buttons are disabled
		});

		collector.on('collect', async (i) => {
			if (i.customId === 'blackjack_hit') {
				// Draws a card from 0-12, and uses the deck[] array to index for the card
				drawnCard = Math.floor(Math.random() * 13);

				// Shows user what card they drew
				if (drawnCard === 9) {
					gameStatus = `You drew a Jack (10).`;
				} else if (drawnCard === 10) {
					gameStatus = 'You drew a Queen (10).';
				} else if (drawnCard === 11) {
					gameStatus = 'You drew a King (10).';
				} else if (drawnCard === 12) {
					gameStatus = 'You drew an Ace (10).';
				} else {
					gameStatus = `You drew a ${drawnCard + 2}.`;
				}

				// Handles if an Ace brings the player over a score of 21
				// Converts the Ace from 11 points to 1 point if so
				if (drawnCard === 11 && (playerHand + drawnCard) > 21) {
					drawnCard = 1;
				}
				playerHand += deck[drawnCard];

				// Checks if the user "busts"
				if (playerHand > 21) {
					gameStatus = 'Bust! You lose.';
					collector.stop('bust');
				}

				// Updates game status
				await i.update({
					embeds: [createGameEmbed(playerHand, dealerHand, gameStatus)]
				});
			}
		});

		// Handles the end of the game
		collector.on('end', async (collected, reason) => {
			gameOver = true;

			// Tells user if the game timed out
			if (reason === 'time') {
				gameStatus = 'Game timed out.';
			}

			// Updates game embed, and removes the buttonsnh
			const finalEmbed = createGameEmbed(playerHand, dealerHand, gameStatus);
			await response.edit({
				embeds: [finalEmbed],
				components: []
			});
		});
	}

}
