// Utility functions for the reminders system
import { COLORS, EMOJI } from './constants';
import { EmbedBuilder, ButtonInteraction } from 'discord.js';
import { Reminder } from '@lib/types/Reminder';

/**
 * Validates an email address format.
 *
 * @param {string} email - The email address to validate.
 * @returns {boolean} True if the email has a valid format; otherwise, false.
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Creates an error embed with the specified title and description.
 *
 * @param {string} title - The error title to display in the embed.
 * @param {string} description - The error description to display in the embed.
 * @returns {EmbedBuilder} A configured EmbedBuilder instance.
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(COLORS.DANGER)
		.setTitle(`${EMOJI.CANCEL} ${title}`)
		.setDescription(description)
		.setTimestamp();
}

/**
 * Creates a success embed for a standard reminder.
 *
 * @param {string} content - The reminder content/message.
 * @param {string} expiryTime - A human-readable time string for when the reminder will trigger.
 * @param {boolean} [withEmail=false] - Whether email notifications are enabled for this reminder.
 * @param {string|null} [email=null] - The email address to notify, if applicable.
 * @returns {EmbedBuilder} A configured EmbedBuilder instance.
 */
export function createReminderSuccessEmbed(
	content: string,
	expiryTime: string,
	withEmail = false,
	email: string | null = null
): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setColor(COLORS.SUCCESS)
		.setTitle(`${EMOJI.REMINDER} Reminder Set!`)
		.setDescription(`I'll remind you about that at **${expiryTime}**.`)
		.addFields({
			name: 'Reminder Content',
			value: `> ${content}`
		});

	// Add email info if applicable
	if (withEmail && email) {
		embed.addFields({
			name: 'Email Notification',
			value: `You'll also receive an email at **${email}** when this reminder triggers.`
		});
	}

	embed.setTimestamp();

	return embed;
}

/**
 * Creates a success embed for a job reminder.
 *
 * @param {string} repeatValue - The repeat frequency (e.g., "daily", "weekly").
 * @param {string} filterValue - The sort/filter selection (e.g., "date", "salary").
 * @param {string} expiryTime - A human-readable time string for when the first alert will trigger.
 * @param {boolean} [withEmail=false] - Whether email notifications are enabled.
 * @param {string|null} [email=null] - The email address to notify, if applicable.
 * @returns {EmbedBuilder} A configured EmbedBuilder instance.
 */
export function createJobReminderSuccessEmbed(
	repeatValue: string,
	filterValue: string,
	expiryTime: string,
	withEmail = false,
	email: string | null = null
): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setColor(COLORS.SECONDARY)
		.setTitle(`${EMOJI.JOB} Job Alert Created`)
		.setDescription(
			`I'll send you job opportunities **${repeatValue}** starting at **${expiryTime}**.`
		)
		.addFields(
			{
				name: 'Frequency',
				value: `${repeatValue.charAt(0).toUpperCase() + repeatValue.slice(1)}`,
				inline: true
			},
			{
				name: 'Sorted By',
				value: `${filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}`,
				inline: true
			}
		);

	// Add email info if applicable
	if (withEmail && email) {
		embed.addFields({
			name: 'Email Notification',
			value: `You'll also receive job alerts at **${email}** when they trigger.`
		});
	}

	embed.setFooter({ text: 'You can update your preferences anytime' }).setTimestamp();

	return embed;
}

/**
 * Returns an icon string for a reminder based on its type and whether email is enabled.
 *
 * @param {Reminder} reminder - The reminder object to inspect.
 * @returns {string} The icon string (may include the email icon).
 */
export function getReminderIcon(reminder: Reminder): string {
	const isJobReminder = reminder.content === 'Job Reminder';
	const emailIcon = reminder.emailNotification ? ` ${EMOJI.EMAIL}` : '';

	return `${isJobReminder ? EMOJI.JOB : EMOJI.REMINDER}${emailIcon}`;
}

/**
 * Checks if the current user (from a ButtonInteraction) already has a Job Reminder.
 * This is a convenience wrapper that queries the reminders collection.
 *
 * @param {ButtonInteraction} buttonInteraction - The interaction to use for user and client context.
 * @returns {Promise<boolean>} True if the user has a Job Reminder; otherwise, false.
 */
export async function checkJobReminderForButton(
	buttonInteraction: ButtonInteraction
): Promise<boolean> {
	const { DB } = await import('@root/config');
	const reminders = await buttonInteraction.client.mongo
		.collection(DB.REMINDERS)
		.find({ owner: buttonInteraction.user.id })
		.toArray();

	return reminders.some((reminder) => reminder.content === 'Job Reminder');
}
