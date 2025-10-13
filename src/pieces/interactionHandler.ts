import { ButtonInteraction, Client, MessageComponentInteraction, StringSelectMenuInteraction } from 'discord.js';
import { handleRpsOptionSelect } from '../commands/fun/rockpaperscissors';
import { handlePollOptionSelect } from '../commands/fun/poll';
import { handleInterviewOptionSelect } from '../commands/jobs/interview';
import { SageInteractionType } from '@lib/types/InteractionType';

async function register(bot: Client): Promise<void> {
	bot.on('interactionCreate', i => {
		if (i.isMessageComponent()) routeComponentInteraction(bot, i);
	});
}

async function routeComponentInteraction(bot: Client, i: MessageComponentInteraction) {
	if (i.isButton()) handleBtnPress(bot, i);
	if (i.isStringSelectMenu()) handleStringSelectMenu(bot, i);
}

export default register;
function handleBtnPress(bot: Client, i: ButtonInteraction) {
	switch (i.customId.split('_')[0] as SageInteractionType) {
		case SageInteractionType.POLL:
			handlePollOptionSelect(bot, i);
			break;
		case SageInteractionType.RPS:
			handleRpsOptionSelect(i);
			break;
	}
}
function handleStringSelectMenu(bot: Client, i: StringSelectMenuInteraction) {
	handleInterviewOptionSelect(i);
}
