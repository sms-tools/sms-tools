import wiki, { languageResult, wikiSummary } from 'wikipedia';
import { smsSender } from '../..';
import { User } from '../../models/user.model';
import { bolderize } from '../../tools/tools';
import ServicesClass from '../service';
import { WikipediaModel } from './wikipediaData.model';

class wikipedia extends ServicesClass {
	constructor() {
		super();
		this.name = 'wikipedia';
		this.description = 'reshearch an article on wikipedia';
		this.version = '1.0';
		this.type = 'command';
		this.commands = ['event', 'selectlanguage', 'search'];
	}

	async newMessage(user: InstanceType<typeof User>, message: string) {
		const language = (await WikipediaModel.findOne({ userID: user._id }, ['language']))?.language ?? 'en';
		if (message.startsWith('event')) {
			message = message.replace('event', '');
			this.event(user, message, language);
		} else if (message.startsWith('selectlanguage') || message.startsWith('sl')) {
			message = message.replace('sl', '');
			message = message.replace('selectlanguage', '');
			this.changeLanguage(user, message);
		} else if (message.startsWith('search')) {
			message = message.replace('search', '');
			this.search(user, message, language);
		} else {
			smsSender.sendSms(
				user,
				`You have selected the ${bolderize('Wikipedia')} service. List of command:
${bolderize('search')} <element>: Search something on Wikipedia
${bolderize('selectLanguage | sl')} <language>: Change the Wikipedia language
${bolderize('event')} <number>: See all events that happened on this date
			
${bolderize('home')}: Go back to the main menu`,
				undefined,
				this.name
			);
		}
	}

	private async search(user: InstanceType<typeof User>, message: string, language: string) {
		if (message.trim() == '') {
			smsSender.sendSms(user, 'Usage: search <terms>\nfor exemple:\nsearch batman', undefined, this.name);
			return;
		}
		wiki.setLang(language);
		const page = await wiki.page(message);
		const categories = await page.summary();
		if (categories.type == 'disambiguation') {
			smsSender.sendSms(
				user,
				`This page is a disambiguation page.\ninformation on this search:\n${categories.extract} \npage link: ` +
					page.fullurl,
				undefined,
				this.name
			);
		} else {
			const intro = await page.intro();
			if (intro.length > 1600) {
				const splitPage = intro.split('\n');
				// Adding the paging sections
				const maxSmsLength = 1600 - 16;
				if (Math.max(...splitPage.map(str => str.length)) > maxSmsLength) {
					smsSender.sendSms(user, 'This page is too large to send', undefined, this.name);
					return;
				}

				splitPage.forEach((el, i) => {
					const pageNumber = '[' + (i + 1) + '/' + splitPage.length + ']';
					smsSender.sendSms(user, pageNumber.concat('\n').concat(el).concat('\n').concat(pageNumber));
				});
				return;
			}
			smsSender.sendSms(user, intro, undefined, this.name);
			smsSender.sendSms(user, 'Attached link:\n' + page.fullurl, undefined, this.name);
		}
	}

	private async changeLanguage(user: InstanceType<typeof User>, message: string) {
		message = message.trim();
		if (message != '') {
			const language = await wiki.languages();
			const selectLanguage = existInLanguage(language, message);
			if (selectLanguage != false) {
				smsSender.sendSms(
					user,
					'You have selected ' + selectLanguage[Object.keys(selectLanguage)[0]] + ' language for Wikipedia.',
					undefined,
					this.name
				);
				await WikipediaModel.updateOne(
					{ userID: user._id },
					{ language: Object.keys(selectLanguage)[0] },
					{ upsert: true, setDefaultsOnInsert: true }
				);
			} else {
				smsSender.sendSms(
					user,
					'Language is unknown. Select another one. eg: fr, de, en',
					undefined,
					this.name
				);
			}
		} else {
			smsSender.sendSms(
				user,
				'no language specified, enter selectLanguage <language>,\n for exemple:\n selectLanguage en',
				undefined,
				this.name
			);
		}
		function existInLanguage(language: languageResult[], search: string) {
			for (const object of language) {
				if (Object.keys(object)[0] == search) {
					return object;
				}
			}
			return false;
		}
	}

	private async event(user: InstanceType<typeof User>, message: string, language: string) {
		try {
			wiki.setLang(language);
			const events = await wiki.onThisDay({ type: 'selected' });
			if (events.selected == undefined) {
				smsSender.sendSms(user, 'Error in Wikipedia', undefined, this.name);
				return;
			}
			if (message.trim() != '') {
				const target = parseInt(message.trim());
				if (message.trim() == 'all') {
					events.selected.forEach((event, i) => {
						smsSender.sendSms(
							user,
							`${bolderize(event.year?.toString() ?? 'xxxx')}\n${
								event.text
							}\nAttached links:${crearteLinkList(event.pages)}\nPage [${i}/${
								events.selected?.length ?? 1 - 1
							}]`,
							undefined,
							this.name
						);
					});
					return;
				} else if (isNaN(target) || target >= events.selected?.length - 1) {
					smsSender.sendSms(user, 'Invalid number', undefined, this.name);
					return;
				} else {
					smsSender.sendSms(
						user,
						`${bolderize(events.selected[target].year?.toString() ?? 'xxxx')}\n${
							events.selected[target].text
						}\nAttached links:${crearteLinkList(events.selected[target].pages)}\nPage [${target}/${
							events.selected.length - 1
						}]`,
						undefined,
						this.name
					);
				}
			} else {
				smsSender.sendSms(
					user,
					`${bolderize(events.selected[0].year?.toString() ?? 'xxxx')}\n${
						events.selected[0].text
					}\nAttached links:${crearteLinkList(events.selected[0].pages)}\nPage [${0}/${
						events.selected.length - 1
					}]`,
					undefined,
					this.name
				);
			}
		} catch (error) {
			smsSender.sendSms(user, 'Error in Wikipedia', undefined, this.name);
		}

		function crearteLinkList(page: wikiSummary[]) {
			return page.map(el => {
				return '\n' + el.normalizedtitle + ': ' + el.content_urls.mobile.page;
			});
		}
	}
}
export default wikipedia;
