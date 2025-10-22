import { Command } from '@lib/types/Command';
import { ChatInputCommandInteraction, InteractionResponse } from 'discord.js';

export default class extends Command {

	description = '';
	extendedHelp = '';
	

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {

	}
}
