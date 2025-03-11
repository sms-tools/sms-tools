import { config } from 'dotenv';
import express from 'express';
import https from 'https';
import mongoose from 'mongoose';
import { AddressInfo } from 'net';
import fs from 'node:fs';
import { sseEvent } from './declaration';
import { eventDelivered, eventfailed, eventSent } from './messageEvent';
import messageRecevied from './messageRecevied';
import getNewMessage from './services/api/router/getNewEvent';
import { log } from './tools/log';
import { SmsSender } from './tools/sendSms';
import { clearPhone, getOrCreateContact, IsPhoneNumber, loadServices } from './tools/tools';

config();
const app = express();
app.use(express.json());
app.use((req, res, next) => {
	const origin =
		process.env.ISDEV == 'false' ? ['https://sms.mpqa.fr'] : ['http://localhost:5173', 'https://sms.mpqa.fr'];
	if (origin.includes(req.headers.origin ?? '')) {
		res.header('Access-Control-Allow-Origin', req.headers.origin);
	}
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.header('Access-Control-Allow-Credentials', 'true');
	next();
});

//////////////////////////data base/////////////////////////////////////////////

// in test, the test script will create the connection to the database
let server;
if (process.env.JEST_WORKER_ID == undefined) {
	// Connect to MongoDB using Mongoose
	if (process.env.ISDEV == 'false') {
		mongoose
			.connect(process.env.URI ?? '')
			.then(() => {
				log('Successfully connected to MongoDB', 'DEBUG', __filename);
			})
			.catch(error => {
				log('Error connecting to MongoDB: ' + error, 'CRITICAL', __filename);
			});
	} else {
		mongoose
			.connect(process.env.BDD_URI_DEV ?? '')
			.then(async () => {
				log('Successfully connected to MongoDB', 'DEBUG', __filename);
			})
			.catch(error => {
				log('Error connecting to MongoDB: ' + error, 'CRITICAL', __filename);
			});

		server = https.createServer(
			{
				key: fs.readFileSync('cert/server.key'),
				cert: fs.readFileSync('cert/server.crt'),
				ca: fs.readFileSync('cert/ca.crt')
			},
			app
		);
	}
}
//////////////////////////express server/////////////////////////////////////////////
if (!server) {
	const listener = app.listen(8080, () => {
		log(`Server started on https://localhost:${(listener.address() as AddressInfo).port}`, 'INFO', __filename);
	});
} else {
	const listener = server.listen(8080, () => {
		log(`Server started on https://localhost:${(listener.address() as AddressInfo).port}`, 'INFO', __filename);
	});
}

app.post('/', async (req, res) => {
	res.status(200).send('Hello World');
	log('root page accessed', 'INFO', __filename, null, req.hostname);
});

app.post('/sms', async (req, res) => {
	res.status(200).send();
	if (typeof req.body.payload.message !== 'string' || typeof req.body.payload.phoneNumber !== 'string') {
		log('Invalid request body', 'ERROR', __filename, null, req.hostname);
		return;
	}

	let phoneNumber = req.body.payload.phoneNumber;
	let message = req.body.payload.message;
	message = message.trim();

	if (phoneNumber.startsWith('+33')) {
		phoneNumber = phoneNumber.replace('+33', '0');
	}

	if (!IsPhoneNumber(phoneNumber)) {
		log('Invalid phone number', 'ERROR', __filename, null, req.hostname);
		return;
	}

	//create user
	const phone = clearPhone(phoneNumber);
	if (!phone) {
		log('Bad phone:', 'ERROR', __filename, phone, 'root');
		return;
	}
	const contact = await getOrCreateContact(phone);
	if (!contact) {
		log('error for create user', 'WARNING', __filename);
		return;
	}
	//pass to other app
	messageRecevied(message, contact, req.body.id);
});

app.post('/sent', (req, res) => {
	res.status(200).send();
	if (typeof req.body.payload.messageId !== 'string') {
		log('Invalid request body for /sent', 'ERROR', __filename, null, req.hostname);
		return;
	}
	eventSent(req.body.payload.messageId, new Date());
});

app.post('/delivered', (req, res) => {
	res.status(200).send();
	if (typeof req.body.payload.messageId !== 'string') {
		log('Invalid request body for /delivered', 'ERROR', __filename, null, req.hostname);
		return;
	}
	eventDelivered(req.body.payload.messageId, new Date());
});

app.post('/failed', (req, res) => {
	res.status(200).send();
	if (typeof req.body.payload.messageId !== 'string' || typeof req.body.payload.reason !== 'string') {
		log('Invalid request body for /failed', 'ERROR', __filename, null, req.hostname);
		return;
	}
	eventfailed(req.body.payload.messageId, new Date(), req.body.payload.reason);
});

app.get('/getNewMessage', (req, res) => getNewMessage(req, res));

//////////////////////////create class/////////////////////////////////////////////
const smsSender = new SmsSender();
const SseSuscriber = new Map<string, (event: sseEvent) => void>(); // Map<phone, sseSender>;
const servicesClass = loadServices(app);

export { app, servicesClass, smsSender, SseSuscriber };
