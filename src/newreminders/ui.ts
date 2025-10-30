// UI component creation functions
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { COLORS, EMOJI } from './constants';

/*
 * Creates a back button to return to the main menu
 */
export function createBackButton(): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('back_to_menu')
				.setLabel('Back to Menu')
				.setEmoji(EMOJI.BACK)
				.setStyle(ButtonStyle.Secondary)
		);
}

/*
 * Creates the main menu embed
 */
export function createMainMenuEmbed(username: string, avatarURL: string): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(COLORS.PRIMARY)
		.setTitle(`${EMOJI.REMINDER} Reminder System`)
		.setDescription('What would you like to do?')
		.setFooter({
			text: `Requested by ${username}`,
			iconURL: avatarURL
		})
		.setTimestamp();
}

/*
 * Creates the main menu buttons
 */
export function createMainMenuButtons(): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('create_reminder')
				.setLabel('Create Reminder')
				.setEmoji(EMOJI.REMINDER)
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('create_job_reminder')
				.setLabel('Job Alert')
				.setEmoji(EMOJI.JOB)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('view_reminders')
				.setLabel('View All')
				.setEmoji(EMOJI.VIEW)
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId('cancel_reminder')
				.setLabel('Cancel')
				.setEmoji(EMOJI.CANCEL)
				.setStyle(ButtonStyle.Danger)
		);
}

/*
 * Creates a reminder modal
 */
export function createReminderModal(): ModalBuilder {
	const modal = new ModalBuilder()
		.setCustomId('reminder_modal')
		.setTitle(`${EMOJI.REMINDER} Create New Reminder`);

	// Add inputs for content and duration
	const contentInput = new TextInputBuilder()
		.setCustomId('content')
		.setLabel('What would you like to be reminded of?')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Enter your reminder message here...')
		.setRequired(true);

	const durationInput = new TextInputBuilder()
		.setCustomId('duration')
		.setLabel('When would you like to be reminded?')
		.setPlaceholder('e.g. 1 hour, 30 minutes, 2 days, tomorrow at 3pm')
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	// Create action rows with inputs
	const contentRow = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);
	const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);

	// Add action rows to the modal
	modal.addComponents(contentRow, durationRow);

	return modal;
}

/*
 * Creates a job reminder modal
 */
export function createJobReminderModal(): ModalBuilder {
	const modal = new ModalBuilder()
		.setCustomId('job_reminder_modal')
		.setTitle(`${EMOJI.JOB} Create Job Alert`);

	// Add inputs for repeat frequency and filter type
	const repeatInput = new TextInputBuilder()
		.setCustomId('repeat')
		.setLabel('How often would you like to receive alerts?')
		.setPlaceholder('Type "daily", "weekly", or "monthly"')
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	const filterInput = new TextInputBuilder()
		.setCustomId('filter')
		.setLabel('Sort jobs by?')
		.setPlaceholder('default, relevance, salary, or date')
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setValue('default'); // Default value

	// Create action rows with inputs
	const repeatRow = new ActionRowBuilder<TextInputBuilder>().addComponents(repeatInput);
	const filterRow = new ActionRowBuilder<TextInputBuilder>().addComponents(filterInput);

	// Add action rows to the modal
	modal.addComponents(repeatRow, filterRow);

	return modal;
}

/*
 * Creates an email notification options embed
 */
export function createEmailOptionsEmbed(isJobReminder = false): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(COLORS.INFO)
		.setTitle(`${EMOJI.EMAIL} Would you like to receive this ${isJobReminder ? 'job alert' : 'reminder'} by email too?`)
		.setDescription(`Choose whether you want to also receive this ${isJobReminder ? 'job alert' : 'reminder'} via email when it triggers.`)
		.setFooter({ text: 'Email notifications are optional' })
		.setTimestamp();
}

/*
 * Creates email notification option buttons
 */
export function createEmailOptionsButtons(isJobReminder = false): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId(isJobReminder ? 'job_email_yes' : 'email_yes')
				.setLabel('Yes, send email')
				.setEmoji(EMOJI.EMAIL)
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(isJobReminder ? 'job_email_no' : 'email_no')
				.setLabel('No, Discord only')
				.setStyle(ButtonStyle.Secondary)
		);
}

/*
 * Creates an email input modal
 */
export function createEmailInputModal(isJobReminder = false): ModalBuilder {
	const modal = new ModalBuilder()
		.setCustomId(isJobReminder ? 'job_email_modal' : 'email_modal')
		.setTitle(`${EMOJI.EMAIL} Email Notification${isJobReminder ? ' for Job Alerts' : ''}`);

	// Add input for email address
	const emailInput = new TextInputBuilder()
		.setCustomId('email')
		.setLabel(`Email address for ${isJobReminder ? 'job alerts' : 'notifications'}:`)
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Enter your email address here...')
		.setRequired(true);

	// Create action row with input
	const emailRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput);

	// Add action row to the modal
	modal.addComponents(emailRow);

	return modal;
}

/*
 * Creates a cancel reminder modal
 */
export function createCancelReminderModal(): ModalBuilder {
	const modal = new ModalBuilder()
		.setCustomId('cancel_reminder_modal')
		.setTitle(`${EMOJI.CANCEL} Cancel Reminder`);

	// Add input for reminder number
	const reminderNumInput = new TextInputBuilder()
		.setCustomId('reminder_number')
		.setLabel('Which reminder would you like to cancel?')
		.setPlaceholder('Enter the number (e.g. 1, 2, 3)')
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	// Create action row with input
	const reminderNumRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reminderNumInput);

	// Add action row to the modal
	modal.addComponents(reminderNumRow);

	return modal;
}
