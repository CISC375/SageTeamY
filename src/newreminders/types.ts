// Type definitions for the reminder system
import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';

// Store reminder data temporarily during creation flow
export interface ReminderData {
	content: string;
	expiryDate: Date;
	buttonInteraction: ButtonInteraction;
	modalInteraction: ModalSubmitInteraction;
}

// Store job reminder data temporarily during creation flow
export interface JobReminderData {
	repeatValue: string;
	filterValue: string;
	buttonInteraction: ButtonInteraction;
	modalInteraction: ModalSubmitInteraction;
}

// Extend the Discord.js Client to include our temporary storage properties
declare module 'discord.js' {
	interface Client {
		reminderTemp?: ReminderData;
		jobReminderTemp?: JobReminderData;
	}
}
