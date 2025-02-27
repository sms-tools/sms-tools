import { Router } from 'express';
import ContactInfo from './router/ContactInfo';
import createContact from './router/createContact';
import getContact from './router/getContact';
import getMessage from './router/getMessage';
import getNewEvent from './router/getNewEvent';
import getProgress from './router/getProgress';
import login from './router/login';
import sendManySms from './router/sendManySms';
import sendSms from './router/sendSms';

function router() {
	const route = Router();

	route.get('/', (req, res) => {
		res.send('hello on sms-tools:api');
	});
	route.post('/login', login);
	route.post('/getMessage', getMessage);
	route.post('/createContact', createContact);
	route.get('/getProgress', getProgress);
	route.post('/getNewEvent', getNewEvent);
	route.post('/sendSms', sendSms);
	route.post('/getContact', getContact);
	route.post('/contactInfo', ContactInfo);
	route.post('/sendManySms', sendManySms);

	return route;
}

export default router;
