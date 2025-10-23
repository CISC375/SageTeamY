// Email handling functionality for reminders
import { ButtonInteraction } from 'discord.js';
import { createEmailInputModal } from './ui';
import { createErrorEmbed, isValidEmail } from './utils';
import { completeReminderCreation } from './reminder-handlers';
import { completeJobReminderCreation } from './job-handlers';

/*
 * Show modal to collect email address for standard reminders
 */
export async function showEmailModal(buttonInteraction: ButtonInteraction): Promise<void> {
	// Create modal for email address
	const modal = createEmailInputModal();

	// Show the modal
	await buttonInteraction.showModal(modal);

	try {
		// Wait for modal submission
		const modalInteraction = await buttonInteraction.awaitModalSubmit({
			time: 180000, // 3 minutes (extended)
			filter: (i) =>
				i.customId === 'email_modal'
                && i.user.id === buttonInteraction.user.id
		});

		// Process modal submission
		const email = modalInteraction.fields.getTextInputValue('email');

		// Simple email validation
		if (!isValidEmail(email)) {
			const errorEmbed = createErrorEmbed(
				'Invalid Email Address',
				`**"${email}"** does not appear to be a valid email address.`
			).setFooter({ text: 'Please try again with a valid email address' });

			// Reply with error
			await modalInteraction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});
			return;
		}

		// Finalize the reminder creation with email
		await completeReminderCreation(
			buttonInteraction,
			true,
			email,
			modalInteraction
		);
	} catch (error) {
		console.error('Error in email modal submission:', error);

		// Only try to update if we haven't already replied
		try {
			// Fallback to creating the reminder without email
			await completeReminderCreation(buttonInteraction, false, null);
		} catch (updateError) {
			console.error('Error updating after email modal error:', updateError);
		}
	}
}

/*
 * Show modal to collect email address for job reminders
 */
export async function showJobEmailModal(buttonInteraction: ButtonInteraction): Promise<void> {
	// Create modal for email address
	const modal = createEmailInputModal(true);

	// Show the modal
	await buttonInteraction.showModal(modal);

	try {
		// Wait for modal submission
		const modalInteraction = await buttonInteraction.awaitModalSubmit({
			time: 180000, // 3 minutes
			filter: (mi) =>
				mi.customId === 'job_email_modal'
                && mi.user.id === buttonInteraction.user.id
		});

		// Process the email and finalize
		const email = modalInteraction.fields.getTextInputValue('email');

		// Email validation
		if (!isValidEmail(email)) {
			await modalInteraction.reply({
				content: `Invalid email address format. Please try again.`,
				ephemeral: true
			});
			return;
		}

		// Finalize job reminder creation with email
		await completeJobReminderCreation(
			buttonInteraction,
			true,
			email,
			modalInteraction
		);
	} catch (error) {
		console.error('Error in job email modal submission:', error);
		// Fallback to no email
		await completeJobReminderCreation(buttonInteraction, false, null);
	}
}
