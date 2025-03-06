import { servicesClass, smsSender, SseSuscriber } from '.';
import { Contact } from './models/contact.model';
import { Message } from './models/message.model';
import { log } from './tools/log';
import { bolderize, getUser } from './tools/tools';

async function messageRecevied(message: string, contact: InstanceType<typeof Contact>, messageId: string) {
	const receivedDate = new Date();
	message = message.trim().toLowerCase();
	log(`Message received`, 'INFO', __filename, { message, user: contact }, contact?._id.toString());

	const messageObj = await new Message({
		message,
		direction: true,
		status: 'received',
		messageId,
		deliveredAt: receivedDate,
		contactID: contact.id
	}).save();

	//send to all sse suscrible client
	if (SseSuscriber && messageObj)
		SseSuscriber.forEach(e =>
			e({
				contactID: contact.id,
				event: 'recevied',
				status: { deliveredAt: receivedDate }
			})
		);

	const user = await getUser(contact.phoneNumber);
	//if this phone is not  an  user command is forbidden
	if (!user) return;
	//go to home menu
	if (message.startsWith('home') || message.startsWith("'home")) {
		message = message.replace('home', '');
		message = message.replace("'home", '');
		message = message.trim();
		user.currentServices = 'nothing';
		await user.save();
		log('user is go to home menu', 'INFO', __filename, { user: user });
	}

	if (user.commandPermeted) {
		//bypass command (disponible evrerywhere)
		let bypassfound = false;
		(await servicesClass).forEach(async service => {
			if (service.type == 'command' && service.bypassTrigger.find(e => e == message)) {
				log(
					`Message transfered for bypass to ${service.name}`,
					'INFO',
					__filename,
					{ message, user: contact, serv: service },
					service.name
				);
				service.newMessage(user, message);
				bypassfound = true;
			}
		});
		if (bypassfound) return;

		//if user is in service
		if (user.currentServices != 'nothing') {
			const service = (await servicesClass).find(e => e.name == user.currentServices);
			if (!service) user.currentServices == 'nothing';
			else {
				service.newMessage(user, message);
				return;
			}
		}

		const messageSplit = message.split(' ');
		const firstWorld = messageSplit.at(0);
		const firstWorldNumber = parseInt(firstWorld ?? 'a');
		//if first part is an number
		if (!isNaN(firstWorldNumber)) {
			const service = (await servicesClass).at(firstWorldNumber);
			if (service) {
				await user.updateOne({ currentServices: service.name });
				if (messageSplit.length >= 1) {
					log('user is enter in services', 'INFO', __filename, { user: user, service });
					service.newMessage(user, messageSplit.slice(1).join(' '));
				}
				return;
			}
		}

		//if first part is an service name
		if (firstWorld) {
			const serv = (await servicesClass).find(e => e.name == firstWorld);
			if (serv) {
				await user.updateOne({ currentServices: serv.name });
				if (messageSplit.length >= 1) {
					log('user is enter in services', 'INFO', __filename, { user: user, serv });
					serv.newMessage(user, messageSplit.slice(1).join(' '));
				}
				return;
			}
		}

		//other case
		smsSender.sendSms(
			user,
			`Select an application:
${(await servicesClass)
	.map((el, i) => {
		return bolderize(i.toString() + ': ' + el.name) + ' ' + el.description + '\n';
	})
	.join('')}
${bolderize('home')}: return on this menu`
		);
	} else {
		// do nothing
	}
}

export default messageRecevied;
