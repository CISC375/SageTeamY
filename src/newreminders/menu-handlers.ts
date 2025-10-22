// Menu handling functionality for the reminder system
import {
	ChatInputCommandInteraction,
	ButtonInteraction,
	ComponentType,
	EmbedBuilder,
	Message
} from 'discord.js';
import { COLORS, EMOJI } from './constants';
import {
	createMainMenuEmbed,
	createMainMenuButtons,
	createBackButton,
	createCancelReminderModal
} from './ui';
import { handleCreateReminder, completeReminderCreation } from './reminder-handlers';
import { handleCreateJobReminder } from './job-handlers';
import { DB } from '@root/config';
import { Reminder } from '@lib/types/Reminder';
import { createErrorEmbed, getReminderIcon } from './utils';
import { reminderTime } from '@root/src/lib/utils/generalUtils';
// Import the email handlers
import { showEmailModal, showJobEmailModal } from './email-handlers';

/*
 * Display the main menu for the reminder system
 */
export async function showMainMenu(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
	// Create a stylish initial embed
	const embed = createMainMenuEmbed(
		interaction.user.username,
		interaction.user.displayAvatarURL()
	);

	// Create buttons with emojis and clear labels
	const row = createMainMenuButtons();

	// Check if this is the initial interaction or a follow-up
	if (interaction instanceof ChatInputCommandInteraction) {
	// Initial command interaction
		await interaction.reply({
			embeds: [embed],
			components: [row],
			ephemeral: true
		});

		// Fetch the sent message (since fetchReply is deprecated)
		const response = (await interaction.fetchReply()) as Message;

		// Create collector for button interactions
		createButtonCollector(response);
	} else {
	// A button interaction (going back to main menu)
		await interaction.update({
			embeds: [embed],
			components: [row]
		});
	}
}

/*
 * Create a button collector for the main menu
 */
export function createButtonCollector(response: Message): void {
	const collector = response.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 120000 // 2 minute timeout (extended)
	});

	collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
		// Handle button clicks
		switch (buttonInteraction.customId) {
			case 'create_reminder':
				await handleCreateReminder(buttonInteraction);
				break;
			case 'create_job_reminder':
				await handleCreateJobReminder(buttonInteraction);
				break;
			case 'view_reminders':
				await handleViewReminders(buttonInteraction);
				break;
			case 'cancel_reminder':
				await handleCancelReminder(buttonInteraction);
				break;
			case 'back_to_menu':
				// Handle going back to the main menu
				await showMainMenu(buttonInteraction);
				break;
			case 'email_yes':
				// Actually call the showEmailModal function when the email_yes button is clicked
				await showEmailModal(buttonInteraction);
				break;
			case 'job_email_yes':
				// Call the job email modal function when the job_email_yes button is clicked
				await showJobEmailModal(buttonInteraction);
				break;
			case 'email_no': {
				// Handle no for email notification - retrieve the reminder data
				const reminderData = buttonInteraction.client.reminderTemp;
				if (reminderData) {
					await handleEmailNoForReminder(buttonInteraction);
				} else {
					const errorEmbed = createErrorEmbed(
						'Error Processing Reminder',
						'Something went wrong while processing your reminder. Please try creating it again.'
					);

					await buttonInteraction.update({
						embeds: [errorEmbed],
						components: [createBackButton()]
					});
				}
				break;
			}
			case 'job_email_no':
				// Handle no for job email notification
				await completeReminderCreation(buttonInteraction, false, null);
				break;
		}
	});

	collector.on('end', async (collected) => {
		if (collected.size === 0) {
			const timeoutEmbed = createErrorEmbed(
				'Reminder Action Timed Out',
				'You can run the command again to set up a reminder.'
			);

			await response.edit({
				embeds: [timeoutEmbed],
				components: []
			});
		}
	});
}

/*
 * Handle the view reminders button
 */
export async function handleViewReminders(buttonInteraction: ButtonInteraction): Promise<void> {
	const reminders: Array<Reminder> = await buttonInteraction.client.mongo
		.collection(DB.REMINDERS)
		.find({ owner: buttonInteraction.user.id })
		.toArray();

	reminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());

	if (reminders.length < 1) {
		const noRemindersEmbed = new EmbedBuilder()
			.setColor(COLORS.INFO)
			.setTitle(`${EMOJI.VIEW} No Reminders Found`)
			.setDescription('You don\'t have any pending reminders!')
			.setFooter({ text: 'Use the CREATE REMINDER button to set one up' })
			.setTimestamp();

		// Update instead of reply to replace the message
		buttonInteraction.update({
			embeds: [noRemindersEmbed],
			components: [createBackButton()] // Add back button
		});
		return;
	}

	const embeds: Array<EmbedBuilder> = [];
	reminders.forEach((reminder, i) => {
		if (i % 10 === 0) { // Reduced to 10 reminders per embed for better readability
			embeds.push(
				new EmbedBuilder()
					.setTitle(`${EMOJI.VIEW} Your Reminders (${reminders.length})`)
					.setColor(COLORS.INFO)
					.setDescription('Here are all your pending reminders:')
					.setFooter({
						text: `Page ${Math.floor(i / 10) + 1}/${Math.ceil(reminders.length / 10)}`
					})
					.setTimestamp()
			);
		}

		const hidden = reminder.mode === 'private';
		const isJobReminder = reminder.content === 'Job Reminder';
		const icon = getReminderIcon(reminder);

		embeds[Math.floor(i / 10)].addFields({
			name: `${i + 1}. ${icon} ${
				hidden
					? isJobReminder
						? 'Job Alert'
						: 'Private Reminder'
					: reminder.content
			}`,
			value: hidden
				? `${EMOJI.REPEAT} **${reminder.repeat}** job reminder filtered by **${reminder.filterBy}**${
					reminder.emailNotification ? `\n${EMOJI.EMAIL} Email notifications to: ${reminder.emailAddress}` : ''
				}`
				: `${EMOJI.TIME} Due: **${reminderTime(reminder)}**${
					reminder.emailNotification ? `\n${EMOJI.EMAIL} Email notifications to: ${reminder.emailAddress}` : ''
				}`
		});
	});

	// Add back button to the response
	const backButton = createBackButton();

	// Update instead of reply to replace the message
	await buttonInteraction.update({
		embeds,
		components: [backButton] // Add back button
	});
}

/*
 * Handle the cancel reminder button
 */
export async function handleCancelReminder(buttonInteraction: ButtonInteraction): Promise<void> {
	// Create modal for reminder cancellation
	const modal = createCancelReminderModal();

	// Show the modal
	await buttonInteraction.showModal(modal);

	// Wait for modal submission
	try {
		const modalInteraction = await buttonInteraction.awaitModalSubmit({
			time: 60000, // 1 minute
			filter: (i) =>
				i.customId === 'cancel_reminder_modal'
                && i.user.id === buttonInteraction.user.id
		});

		// Process modal submission
		const reminderNumStr = modalInteraction.fields.getTextInputValue('reminder_number');
		const reminderNum = parseInt(reminderNumStr) - 1; // Convert to 0-based index

		if (isNaN(reminderNum) || reminderNum < 0) {
			const errorEmbed = createErrorEmbed(
				'Invalid Reminder Number',
				`**"${reminderNumStr}"** is not a valid reminder number. Please enter a positive integer.`
			).setFooter({ text: 'Use the VIEW REMINDERS button to see your reminders and their numbers' });

			// Defer the modal reply to acknowledge it without sending a visible message
			await modalInteraction.deferUpdate();

			// Update the original message with the error
			await buttonInteraction.editReply({
				embeds: [errorEmbed],
				components: [createBackButton()] // Add back button
			});

			return;
		}

		// Get user's reminders and sort them
		const reminders: Array<Reminder> = await modalInteraction.client.mongo
			.collection(DB.REMINDERS)
			.find({ owner: modalInteraction.user.id })
			.toArray();

		reminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());

		// Check if the reminder exists
		const reminder = reminders[reminderNum];
		if (!reminder) {
			const notFoundEmbed = createErrorEmbed(
				'Reminder Not Found',
				`I couldn't find reminder **#${reminderNum + 1}**.`
			).setFooter({ text: 'Use the VIEW REMINDERS button to see your current reminders' });

			// Defer the modal reply to acknowledge it without sending a visible message
			await modalInteraction.deferUpdate();

			// Update the original message with the error
			await buttonInteraction.editReply({
				embeds: [notFoundEmbed],
				components: [createBackButton()] // Add back button
			});

			return;
		}

		// Delete the reminder
		await modalInteraction.client.mongo
			.collection(DB.REMINDERS)
			.findOneAndDelete(reminder);

		const hidden = reminder.mode === 'private';
		const isJobReminder = reminder.content === 'Job Reminder';
		const emailInfo = reminder.emailNotification ? `\nEmail notifications to ${reminder.emailAddress} have been canceled.` : '';

		const successEmbed = new EmbedBuilder()
			.setColor(COLORS.SUCCESS)
			.setTitle(`${EMOJI.CANCEL} Reminder Cancelled`)
			.setDescription(
				`Successfully cancelled reminder **#${reminderNum + 1}**: ${
					hidden
						? isJobReminder ? 'Job Alert' : 'Private Reminder'
						: `"${reminder.content}"`
				}${emailInfo}`
			)
			.setTimestamp();

		// Defer the modal reply to acknowledge it without sending a visible message
		await modalInteraction.deferUpdate();

		// Update the original message with the success info
		await buttonInteraction.editReply({
			embeds: [successEmbed],
			components: [createBackButton()] // Add back button
		});
	} catch (error) {
		console.error('Error in modal submission:', error);

		const errorEmbed = createErrorEmbed(
			'Cancellation Failed',
			'The reminder cancellation process timed out or an error occurred.'
		);

		// Update the original button interaction
		await buttonInteraction.editReply({
			embeds: [errorEmbed],
			components: [createBackButton()] // Add back button
		});
	}
}

/*
 * Handle the email no button for standard reminders
 */
export async function handleEmailNoForReminder(buttonInteraction: ButtonInteraction): Promise<void> {
	// Get the reminder data from client storage
	const reminderData = buttonInteraction.client.reminderTemp;

	if (reminderData) {
		// Finalize without email
		await completeReminderCreation(buttonInteraction, false, null);
	} else {
		const errorEmbed = createErrorEmbed(
			'Error Processing Reminder',
			'Something went wrong while processing your reminder. Please try creating it again.'
		);

		await buttonInteraction.update({
			embeds: [errorEmbed],
			components: [createBackButton()]
		});
	}
}
