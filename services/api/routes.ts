import { Router } from 'express';
import ContactInfo from './router/ContactInfo';
import createContact from './router/createContact';
import getContact from './router/getContact';
import getMessage from './router/getMessage';
import getNewMessage from './router/getNewMessage';
import getProgress from './router/getProgress';
import login from './router/login';
import sendSms from './router/sendSms';
import sendManySms from './router/sendManySms';

function router() {
	const route = Router();

	route.post('/login', login);
	route.post('/getMessage', getMessage);
	route.post('/createContact', createContact);
	route.get('/getProgress', getProgress);
	route.post('/getNewMessage', getNewMessage);
	route.post('/sendSms', sendSms);
	route.post('/getContact', getContact);
	route.post('/contactInfo', ContactInfo);
	route.post('/sendManySms', sendManySms);

	return route;
}

export default router;
