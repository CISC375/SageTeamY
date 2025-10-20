import { Command } from '@lib/types/Command';

export default class extends Command {

	description = '';
	extendedHelp = '';

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {

	}
}
