import { Reminder } from '@lib/types/Reminder';
import { DB } from '@root/config';
import {
	ActionRowBuilder,
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ComponentType,
	InteractionResponse,
	MessageFlags,
	StringSelectMenuBuilder
} from 'discord.js';
import { Command } from '@lib/types/Command';
import { ObjectId } from 'mongodb';

const PAGE_SIZE = 25;
export default class extends Command {

	description = 'Cancel any pending reminders you may have.';
	extendedHelp = 'You can only cancel one reminder at a time';

	options: ApplicationCommandOptionData[] = [
		{
			name: 'remindernumber',
			type: ApplicationCommandOptionType.Integer,
			required: false,
			description: 'List index (from /viewremind) of the reminder to cancel (1-based)'
		},
		{
			name: 'id',
			type: ApplicationCommandOptionType.String,
			required: false,
			description: 'Advanced: reminder ObjectId (for power users)'
		},
		{
			name: 'page',
			type: ApplicationCommandOptionType.Integer,
			required: false,
			description: 'Advanced: open the selection menu at a specific page',
			minValue: 1
		}
	];

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		/* const remindNum = interaction.options.getInteger('remindernumber') - 1;

		const reminders: Array<Reminder> = await interaction.client.mongo.collection(DB.REMINDERS)
			.find({ owner: interaction.user.id }).toArray();
		reminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());
		const reminder = reminders[remindNum];

		if (!reminder) {
			interaction.reply({
				content: `I couldn't find reminder **${remindNum}**. Use the \`viewremind\` command to see your current reminders.`,
				ephemeral: true
			});
		}

		interaction.client.mongo.collection(DB.REMINDERS).findOneAndDelete(reminder);

		const hidden = reminder.mode === 'private';
		return interaction.reply({
			content: `Canceled reminder: **${reminder.content}**`,
			ephemeral: hidden
		}); */
		const numberOpt = interaction.options.getInteger('remindernumber');
		const idOpt = interaction.options.getString('id');
		const pageOpt = interaction.options.getInteger('page') ?? 1;

		const coll = interaction.client.mongo.collection<Reminder>(DB.REMINDERS);
		const reminders = await coll.find({ owner: interaction.user.id }).toArray();

		// Sort by soonest first for a stable, predictable order
		reminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());

		// Nothing to cancel?
		if (reminders.length === 0) {
			return interaction.reply({
				content: 'You have no pending reminders. 🎉',
				flags: MessageFlags.Ephemeral
			});
		}

		// 1) Power path: cancel by ObjectId string
		if (idOpt) {
			let objId: ObjectId;
			try {
				objId = new ObjectId(idOpt);
			} catch {
				return interaction.reply({
					content: 'That ID is not a valid reminder identifier.',
					flags: MessageFlags.Ephemeral
				});
			}

			const toDelete = reminders.find(r => (r as any)._id?.toString() === objId.toString());
			if (!toDelete) {
				return interaction.reply({
					content: 'I couldn’t find a reminder with that ID. Use `/viewremind` or the dropdown instead.',
					flags: MessageFlags.Ephemeral
				});
			}
			const delRes = await coll.deleteOne({ _id: objId, owner: interaction.user.id });
			if (delRes.deletedCount !== 1) {
				return interaction.reply({ content: 'Hmm, I couldn’t delete that. Try again.', flags: MessageFlags.Ephemeral });
			}
			const hidden = toDelete.mode === 'private';
			return interaction.reply({
				content: `Canceled reminder: **${toDelete.content}**`,
				flags: hidden ? MessageFlags.Ephemeral : undefined
			});
		}

		// 2) Power path: cancel by 1-based index
		if (numberOpt !== null) {
			const index = numberOpt - 1;
			if (index < 0 || index >= reminders.length) {
				return interaction.reply({
					content: `I couldn’t find reminder **#${numberOpt}**. Use \`/viewremind\` to see your list.`,
					flags: MessageFlags.Ephemeral
				});
			}
			const reminder = reminders[index];
			const delRes = await coll.deleteOne({
				_id: (reminder as any)._id,
				owner: interaction.user.id
			});
			if (delRes.deletedCount !== 1) {
				return interaction.reply({ content: 'Hmm, I couldn’t delete that. Try again.', flags: MessageFlags.Ephemeral });
			}
			const hidden = reminder.mode === 'private';
			return interaction.reply({
				content: `Canceled reminder: **${reminder.content}**`,
				flags: hidden ? MessageFlags.Ephemeral : undefined
			});
		}

		// 3) Friendly path: interactive select menu (paginated)
		const totalPages = Math.max(1, Math.ceil(reminders.length / PAGE_SIZE));
		const page = Math.min(Math.max(1, pageOpt), totalPages);
		const { menu, navRow } = this.buildSelect(reminders, page, totalPages);

		const replyInteraction = await interaction.reply({
			content: `Pick a reminder to cancel (page ${page}/${totalPages}):`,
			components: navRow ? [menu, navRow] : [menu],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		});

		// Collect interactions from this user only, ephemeral
		const collector = replyInteraction.resource.message.createMessageComponentCollector({
			componentType: ComponentType.StringSelect,
			time: 60_000,
			filter: (i) => i.user.id === interaction.user.id
		});

		const buttonCollector = replyInteraction.resource.message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60_000,
			filter: (i) => i.user.id === interaction.user.id
		});

		collector.on('collect', async (i) => {
			const chosenId = i.values[0];
			const chosen = reminders.find(r => (r as any)._id?.toString() === chosenId);
			if (!chosen) {
				// since the collector is tied to this message, use update/deferUpdate patterns
				return i.update({ content: 'That reminder no longer exists.', components: [] });
			}

			const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`confirm:${chosenId}`)
					.setLabel('Confirm cancel')
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
					.setCustomId('cancel')
					.setLabel('Never mind')
					.setStyle(ButtonStyle.Secondary)
			);

			// optionally disable the select so users can't pick twice
			const disabledMenu = i.message.components?.[0] ?? null;
			if (disabledMenu) {
				// clone row & disable the select
				const row = ActionRowBuilder.from(disabledMenu as any /* TODO fix this */) as ActionRowBuilder<StringSelectMenuBuilder>;
				const select = StringSelectMenuBuilder.from(row.components[0] as any).setDisabled(true);
				row.setComponents(select);
				return i.update({
					content: `Are you sure you want to cancel:\n> **${chosen.content}**`,
					// eslint-disable-next-line no-extra-parens -- nullish coalescing must occur before spread operator
					components: [row, ...(i.message.components?.slice(1) ?? []), confirmRow]
				});
			}

			return i.update({
				content: `Are you sure you want to cancel:\n> **${chosen.content}**`,
				components: [confirmRow]
			});
		});


		buttonCollector.on('collect', async (i) => {
			try {
				if (i.customId === 'cancel') {
					return i.update({ content: 'Okay, leaving your reminders as-is.', components: [] });
				}
				if (i.customId.startsWith('page:')) {
					const nextPage = Number(i.customId.split(':')[1]);
					const { menu: nextMenu, navRow: nextNav } = this.buildSelect(reminders, nextPage, totalPages);
					return i.update({
						content: `Pick a reminder to cancel (page ${nextPage}/${totalPages}):`,
						components: nextNav ? [nextMenu, nextNav] : [nextMenu]
					});
				}
				if (i.customId.startsWith('confirm:')) {
					const idStr = i.customId.split(':')[1];
					const objId = new ObjectId(idStr);
					const target = reminders.find(r => (r as any)._id?.toString() === idStr);
					const delRes = await coll.deleteOne({ _id: objId, owner: interaction.user.id });

					if (delRes.deletedCount !== 1) {
						return i.update({
							content: 'Something went wrong; I couldn’t delete that reminder. Try again.',
							components: []
						});
					}
					// const hidden = target?.mode === 'private';
					return i.update({
						content: `Canceled reminder: **${target?.content ?? '(unknown)'}**`,
						components: []
						// Parent interaction was already ephemeral; here we just update
					});
				}
			} catch (err) {
				return i.reply({ content: 'Unexpected error while handling your action.', flags: MessageFlags.Ephemeral });
			}
		});
	}

	private buildSelect(reminders: Reminder[], page: number, totalPages: number) {
		const start = (page - 1) * PAGE_SIZE;
		const slice = reminders.slice(start, start + PAGE_SIZE);

		const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId('reminder-select')
				.setPlaceholder('Choose a reminder…')
				.addOptions(
					...slice.map((r, idx) => ({
						label: this.truncate(r.content, 100),
						description: `Due ${new Date(r.expires).toLocaleString()} • #${start + idx + 1}`,
						value: (r as any)._id.toString()
					}))
				)
		);

		let navRow: ActionRowBuilder<ButtonBuilder> | null = null;
		if (totalPages > 1) {
			navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`page:${Math.max(1, page - 1)}`)
					.setLabel('Prev')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page <= 1),
				new ButtonBuilder()
					.setCustomId(`page:${Math.min(totalPages, page + 1)}`)
					.setLabel('Next')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= totalPages)
			);
		}
		return { menu, navRow };
	}

	private truncate(str: string, len: number) {
		return str.length > len ? `${str.slice(0, len - 1)}…` : str;
	}

}
