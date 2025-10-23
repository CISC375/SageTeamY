// Job reminder handling functionality
import {
	ButtonInteraction,
	ModalSubmitInteraction,
	ComponentType,
	EmbedBuilder
} from 'discord.js';
import { JobReminderData } from './types';
import { COLORS, EMOJI } from './constants';
import {
	createBackButton,
	createEmailOptionsEmbed,
	createEmailOptionsButtons,
	createJobReminderModal
} from './ui';
import { createErrorEmbed, createJobReminderSuccessEmbed, checkJobReminderForButton } from './utils';
import { DB } from '@root/config';
import { Reminder } from '@lib/types/Reminder';
import { reminderTime } from '@root/src/lib/utils/generalUtils';
import { showJobEmailModal } from './email-handlers';

/*
 * Handle creating a job reminder
 */
export async function handleCreateJobReminder(buttonInteraction: ButtonInteraction): Promise<void> {
	// Check for existing job reminder using our utility that works with ButtonInteraction
	if (await checkJobReminderForButton(buttonInteraction)) {
		const errorEmbed = createErrorEmbed(
			'Job Reminder Already Exists',
			'You currently already have a job reminder set. To clear your existing job reminder, use the CANCEL button and provide the reminder number.'
		);

		await buttonInteraction.update({
			embeds: [errorEmbed],
			components: [createBackButton()] // Add back button
		});
		return;
	}

	// Create modal for job reminder settings
	const modal = createJobReminderModal();

	// Show the modal
	await buttonInteraction.showModal(modal);

	// Wait for modal submission
	try {
		const modalInteraction = await buttonInteraction.awaitModalSubmit({
			time: 180000, // 3 minutes (extended)
			filter: (i: ModalSubmitInteraction) =>
				i.customId === 'job_reminder_modal'
                && i.user.id === buttonInteraction.user.id
		});

		// Process modal submission
		const repeatValue = modalInteraction.fields.getTextInputValue('repeat').toLowerCase();
		let filterValue = modalInteraction.fields.getTextInputValue('filter').toLowerCase();

		// Validate repeat input
		if (repeatValue !== 'daily' && repeatValue !== 'weekly' && repeatValue !== 'monthly') {
			const errorEmbed = createErrorEmbed(
				'Invalid Repeat Option',
				`**"${repeatValue}"** is not a valid repeat option. Please use "daily", "weekly", or "monthly".`
			);

			// Defer the modal reply to acknowledge it without sending a visible message
			await modalInteraction.deferUpdate();

			// Update the original message with the error
			await buttonInteraction.editReply({
				embeds: [errorEmbed],
				components: [createBackButton()] // Add back button
			});

			return;
		}

		// Validate filter input
		const validFilters = ['default', 'relevance', 'salary', 'date'];
		if (!validFilters.includes(filterValue)) {
			filterValue = 'default'; // Fallback to default if invalid
		}

		// Store job reminder data
		const jobReminderData: JobReminderData = {
			repeatValue,
			filterValue,
			buttonInteraction,
			modalInteraction
		};

		// Ask about email notifications
		await askForJobEmailNotification(jobReminderData);
	} catch (error) {
		console.error('Error in modal submission:', error);
		const errorEmbed = createErrorEmbed(
			'Job Alert Creation Failed',
			'The job alert creation process timed out or an error occurred.'
		);

		// Update the original button interaction instead of creating a new message
		await buttonInteraction.editReply({
			embeds: [errorEmbed],
			components: [createBackButton()] // Add back button
		});
	}
}

/*
 * Ask if the user wants email notifications for job reminders
 */
export async function askForJobEmailNotification(jobReminderData: JobReminderData): Promise<void> {
	const { buttonInteraction, modalInteraction } = jobReminderData;

	// Create embed asking about email notifications
	const emailEmbed = createEmailOptionsEmbed(true);

	// Create Yes/No buttons
	const emailRow = createEmailOptionsButtons(true);

	// Store the job reminder data in the client's temporary collection
	modalInteraction.client.jobReminderTemp = jobReminderData;

	// Defer the modal reply to acknowledge it
	await modalInteraction.deferUpdate();

	// Update original message to ask about email
	const message = await buttonInteraction.editReply({
		embeds: [emailEmbed],
		components: [emailRow]
	});

	// Create a dedicated collector for this specific message
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 60000 // 1 minute timeout
	});

	collector.on('collect', async (i) => {
		// Make sure it's the right user
		if (i.user.id !== buttonInteraction.user.id) {
			await i.reply({
				content: 'This button is not for you.',
				ephemeral: true
			});
			return;
		}

		// Stop the collector since we've handled the interaction
		collector.stop();

		if (i.customId === 'job_email_yes') {
			await showJobEmailModal(i);
		} else if (i.customId === 'job_email_no') {
			// Handle "No, Discord only" option
			await completeJobReminderCreation(buttonInteraction, false, null);
		}
	});

	// Handle collector end (timeout)
	collector.on('end', collected => {
		if (collected.size === 0) {
			// If no buttons were pressed, create without email
			completeJobReminderCreation(buttonInteraction, false, null);
		}
	});
}

/*
 * Create and store the job reminder with or without email
 */
export async function completeJobReminderCreation(
	buttonInteraction: ButtonInteraction,
	withEmail: boolean,
	email: string | null,
	modalInteraction?: ModalSubmitInteraction
): Promise<void> {
	try {
		// Get the job reminder data
		const jobReminderData = buttonInteraction.client.jobReminderTemp;

		// Check if we have valid job reminder data
		if (!jobReminderData || !jobReminderData.repeatValue || !jobReminderData.filterValue) {
			const errorEmbed = createErrorEmbed(
				'Error Creating Job Alert',
				'Missing job alert information. Please try creating your job alert again.'
			);

			// If we have a modal interaction, respond to that
			if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
				await modalInteraction.reply({
					embeds: [errorEmbed],
					ephemeral: true
				});
			} else {
				// Otherwise try to update the button interaction
				try {
					await buttonInteraction.update({
						embeds: [errorEmbed],
						components: [createBackButton()]
					});
				} catch (updateError) {
					// If updating fails, try editing
					await buttonInteraction.editReply({
						embeds: [errorEmbed],
						components: [createBackButton()]
					});
				}
			}
			return;
		}

		const { repeatValue, filterValue } = jobReminderData;

		// Create the job reminder object
		const jobReminder: Reminder = {
			owner: buttonInteraction.user.id,
			content: 'Job Reminder',
			mode: 'private',
			expires: new Date(), // Set to now, will be handled by the job scheduler
			repeat: repeatValue as 'daily' | 'weekly',
			filterBy: filterValue as 'default' | 'relevance' | 'salary' | 'date',
			emailNotification: withEmail,
			emailAddress: withEmail ? email : null
		};

		// Store the job reminder in the database
		await buttonInteraction.client.mongo
			.collection(DB.REMINDERS)
			.insertOne(jobReminder);

		// Create success embed
		const successEmbed = createJobReminderSuccessEmbed(
			repeatValue,
			filterValue,
			reminderTime(jobReminder),
			withEmail,
			email
		);

		// Handle the response based on which interaction is available
		if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
			// If we have a modal interaction that hasn't been replied to yet
			await modalInteraction.reply({
				content: 'Your job alert has been created successfully!',
				ephemeral: true
			});

			// Update the original message
			await buttonInteraction.editReply({
				embeds: [successEmbed],
				components: [createBackButton()]
			});
		} else {
			// Otherwise try to update the button interaction
			try {
				await buttonInteraction.update({
					embeds: [successEmbed],
					components: [createBackButton()]
				});
			} catch (updateError) {
				// If updating fails, try editing
				await buttonInteraction.editReply({
					embeds: [successEmbed],
					components: [createBackButton()]
				});
			}
		}

		// Clean up temporary data
		delete buttonInteraction.client.jobReminderTemp;
	} catch (error) {
		console.error('Error in completeJobReminderCreation:', error);

		// Try to give feedback through any available channel
		const errorEmbed = new EmbedBuilder()
			.setColor(COLORS.WARNING)
			.setTitle(`${EMOJI.JOB} Job Alert Process Completed`)
			.setDescription('Your job alert has been created, but there was an issue updating the display.')
			.setTimestamp();

		try {
			if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
				await modalInteraction.reply({
					embeds: [errorEmbed],
					ephemeral: true
				});
			} else {
				await buttonInteraction.editReply({
					embeds: [errorEmbed],
					components: [createBackButton()]
				});
			}
		} catch (secondError) {
			console.error('Even the error handler failed:', secondError);
		}
	}
}
