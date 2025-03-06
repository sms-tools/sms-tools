import { Request, Response } from 'express';
import { SseSuscriber } from '../../..';
import { sseEvent } from '../../../declaration';
import { log } from '../../../tools/log';
import authenticate from '../authentificate';

async function getNewEvent(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (!user) return;

	// write header for sse
	res.writeHead(200, {
		Connection: 'keep-alive',
		'Cache-Control': 'no-cache',
		'Content-Type': 'text/event-stream'
	});
	log('Client connected to SSE', 'INFO', __filename, { user }, user.id);

	// aff callback to sse shared object
	const id = Date.now().toString(36);
	const sendMessage = (event: sseEvent) => {
		try {
			res.write(`${JSON.stringify(event)}`);
		} catch (error) {
			log('Error sending SSE message', 'ERROR', __filename, { user, error }, user.id);
		}
	};
	SseSuscriber.set(id, sendMessage);

	// if client is desconected
	res.on('close', () => {
		log('Client disconnected from SSE', 'INFO', __filename, { user }, user.id);
		SseSuscriber.delete(id);
		res.end();
	});
}

export default getNewEvent;
