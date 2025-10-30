// This file contains the command handler for the NEW reminder system of the Discord bot.

import { BOT } from '@root/config';
import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@lib/types/Command';
import { showMainMenu } from '../../newreminders/menu-handlers';

export default class extends Command {

	description = `View ${BOT.NAME} reminders menu.`;
	extendedHelp = 'Create reminders for anything - one-time or recurring job alerts with optional email notifications.';
	options = []; // No options needed as we are using buttons

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<void> {
		await showMainMenu(interaction);
	}

}
