// Standard reminder handling functionality
import {
	ButtonInteraction,
	ModalSubmitInteraction,
	EmbedBuilder
} from 'discord.js';
import { ReminderData } from './types';
import { COLORS, EMOJI } from './constants';
import {
	createBackButton,
	createEmailOptionsEmbed,
	createEmailOptionsButtons,
	createReminderModal
} from './ui';
import { createErrorEmbed, createReminderSuccessEmbed } from './utils';
import { DB } from '@root/config';
import { Reminder } from '@lib/types/Reminder';
import parse from 'parse-duration';
import { reminderTime } from '@root/src/lib/utils/generalUtils';

/*
 * Handle the create reminder button interaction
 */
export async function handleCreateReminder(buttonInteraction: ButtonInteraction): Promise<void> {
	// Store reference to original message

	// Unused but might need later
	// const originalMessage = buttonInteraction.message;

	// Create modal for reminder details
	const modal = createReminderModal();

	// Show the modal
	await buttonInteraction.showModal(modal);

	// Wait for modal submission
	try {
		const modalInteraction = await buttonInteraction.awaitModalSubmit({
			time: 180000, // 3 minutes (extended)
			filter: (i: ModalSubmitInteraction) =>
				i.customId === 'reminder_modal'
                && i.user.id === buttonInteraction.user.id
		});

		// Process modal submission
		const content = modalInteraction.fields.getTextInputValue('content');
		const rawDuration = modalInteraction.fields.getTextInputValue('duration');
		const duration = parse(rawDuration);

		if (!duration) {
			const errorEmbed = createErrorEmbed(
				'Invalid Time Format',
				`**"${rawDuration}"** is not a valid duration.\nYou can use words like hours, minutes, seconds, days, weeks, months, or years.`
			).setFooter({ text: 'Try something like "3 hours" or "2 days"' });

			// Defer the modal reply to acknowledge it without sending a visible message
			await modalInteraction.deferUpdate();

			// Update the original message with the error
			await buttonInteraction.editReply({
				embeds: [errorEmbed],
				components: [createBackButton()]
			});

			return;
		}

		// Calculate the expiry date
		const expiryDate = new Date(duration + Date.now());

		// Store the reminder data temporarily
		const reminderData: ReminderData = {
			content,
			expiryDate,
			buttonInteraction,
			modalInteraction
		};

		// Ask the user if they want email notifications
		await askForEmailNotification(reminderData);
	} catch (error) {
		console.error('Error in modal submission:', error);

		const errorEmbed = createErrorEmbed(
			'Reminder Creation Failed',
			'The reminder creation process timed out or an error occurred.'
		);

		// Update the original button interaction
		await buttonInteraction.editReply({
			embeds: [errorEmbed],
			components: [createBackButton()] // Add back button
		});
	}
}

/*
 * Ask if the user wants email notifications for standard reminders
 */
export async function askForEmailNotification(reminderData: ReminderData): Promise<void> {
	const { buttonInteraction, modalInteraction } = reminderData;

	// Create embed asking about email notifications
	const emailEmbed = createEmailOptionsEmbed();

	// Create Yes/No buttons
	const emailRow = createEmailOptionsButtons();

	// Store the reminder data in the client's temporary collection
	// This way we can access it when the user makes a choice
	modalInteraction.client.reminderTemp = reminderData;

	// Defer the modal reply to acknowledge it
	await modalInteraction.deferUpdate();

	// Update original message to ask about email
	await buttonInteraction.editReply({
		embeds: [emailEmbed],
		components: [emailRow]
	});
}

/*
 * Create and store the reminder with or without email
 */
export async function completeReminderCreation(
	buttonInteraction: ButtonInteraction,
	withEmail: boolean,
	email: string | null,
	modalInteraction?: ModalSubmitInteraction
): Promise<void> {
	try {
		// Get the reminder data
		const reminderData = buttonInteraction.client.reminderTemp;

		// Check if we have valid reminder data
		if (!reminderData || !reminderData.content || !reminderData.expiryDate) {
			const errorEmbed = createErrorEmbed(
				'Error Creating Reminder',
				'Missing reminder information. Please try creating your reminder again.'
			);

			// If we have a modal interaction, respond to that
			if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
				await modalInteraction.reply({
					embeds: [errorEmbed],
					ephemeral: true
				});
			} else {
				// Otherwise try to update the button interaction
				await buttonInteraction.update({
					embeds: [errorEmbed],
					components: [createBackButton()]
				});
			}
			return;
		}

		const { content, expiryDate } = reminderData;

		// Create the reminder object
		const reminder: Reminder = {
			owner: buttonInteraction.user.id,
			content,
			mode: 'public', // could be changed to private if needed
			expires: expiryDate,
			repeat: null, // No repeat by default
			emailNotification: withEmail,
			emailAddress: withEmail ? email : null
		};

		// Store the reminder in the database
		await buttonInteraction.client.mongo
			.collection(DB.REMINDERS)
			.insertOne(reminder);

		// Create success embed
		const successEmbed = createReminderSuccessEmbed(
			content,
			reminderTime(reminder),
			withEmail,
			email
		);

		// Handle the response based on which interaction is available
		if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
			// If we have a modal interaction that hasn't been replied to yet
			await modalInteraction.reply({
				content: 'Your reminder has been created successfully!',
				ephemeral: true
			});

			// Update the original message
			await buttonInteraction.editReply({
				embeds: [successEmbed],
				components: [createBackButton()]
			});
		} else if (!buttonInteraction.replied) {
			// Otherwise try to update the button interaction
			// First check if we can update
			await buttonInteraction.update({
				embeds: [successEmbed],
				components: [createBackButton()]
			});
		} else {
			// If we can't update, try to edit the reply
			await buttonInteraction.editReply({
				embeds: [successEmbed],
				components: [createBackButton()]
			});
		}

		// Clean up temporary data
		delete buttonInteraction.client.reminderTemp;
	} catch (error) {
		console.error('Error in completeReminderCreation:', error);

		// Try to give feedback through any available channel
		const errorEmbed = new EmbedBuilder()
			.setColor(COLORS.WARNING)
			.setTitle(`${EMOJI.REMINDER} Reminder Process Completed`)
			.setDescription('Your reminder has been created, but there was an issue updating the display.')
			.setTimestamp();

		try {
			if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
				await modalInteraction.reply({
					embeds: [errorEmbed],
					ephemeral: true
				});
			} else if (!buttonInteraction.replied) {
				await buttonInteraction.update({
					embeds: [errorEmbed],
					components: [createBackButton()]
				});
			}
		} catch (secondError) {
			console.error('Even the error handler failed:', secondError);
		}
	}
}
