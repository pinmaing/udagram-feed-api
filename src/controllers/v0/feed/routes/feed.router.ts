import {Router, Request, Response} from 'express';
import {FeedItem} from '../models/FeedItem';
import {NextFunction} from 'connect';
import * as jwt from 'jsonwebtoken';
import * as AWS from '../../../../aws';
import * as c from '../../../../config/config';
import { v4 as uuid } from 'uuid'

const router: Router = Router();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.headers || !req.headers.authorization) {
    return res.status(401).send({message: 'No authorization headers.'});
  }

  const tokenBearer = req.headers.authorization.split(' ');
  if (tokenBearer.length != 2) {
    return res.status(401).send({message: 'Malformed token.'});
  }

  const token = tokenBearer[1];
  return jwt.verify(token, c.config.jwt.secret, (err, decoded) => {
    if (err) {
      return res.status(500).send({auth: false, message: 'Failed to authenticate.'});
    }
    return next();
  });
}

// Get all feed items
router.get('/', async (req: Request, res: Response) => {
  let pid = uuid();
  console.log(new Date().toLocaleString() + `: ${pid} - User requested for Feed Get URL(api/v0/feed/)`);
  const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]});
  items.rows.map((item) => {
    if (item.url) {
      item.url = AWS.getGetSignedUrl(item.url);
    }
  });
  console.log(new Date().toLocaleString() + `: ${pid} - Finished processing request for getting all Feed items`);
  res.send(items);
});

// Get a feed resource
router.get('/:id',
    async (req: Request, res: Response) => {
      let pid = uuid();
      const {id} = req.params;
      console.log(new Date().toLocaleString() + `: ${pid} - User requested to get Feed ID : ${id}`);
      const item = await FeedItem.findByPk(id);
      console.log(new Date().toLocaleString() + `: ${pid} - Finished processing request for getting Feed ID : ${id}`);
      res.send(item);
    });

// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName',
    requireAuth,
    async (req: Request, res: Response) => {
      const {fileName} = req.params;
      let pid = uuid();
      console.log(new Date().toLocaleString() + `: ${pid} - User requested to get Feed Item Signed-URL : ${fileName}`);
      const url = AWS.getPutSignedUrl(fileName);
      console.log(new Date().toLocaleString() + `: ${pid} - Finished processing request for getting Feed Item Signed-URL : ${fileName}`);
      res.status(201).send({url: url});
    });

// Create feed with metadata
router.post('/',
    requireAuth,
    async (req: Request, res: Response) => {
      const caption = req.body.caption;
      const fileName = req.body.url; // same as S3 key name
      let pid = uuid();
      console.log(new Date().toLocaleString() + `: ${pid} - User requested to post Feed Item : ${caption}`);
      if (!caption) {
        console.log(new Date().toLocaleString() + `: ${pid} - Finished processing request for posting Feed Item with error : ${caption}`);
        return res.status(400).send({message: 'Caption is required or malformed.'});
      }

      if (!fileName) {
        console.log(new Date().toLocaleString() + `: ${pid} - Finished processing request for posting Feed Item with error : ${fileName}`);
        return res.status(400).send({message: 'File url is required.'});
      }

      const item = await new FeedItem({
        caption: caption,
        url: fileName,
      });

      const savedItem = await item.save();

      savedItem.url = AWS.getGetSignedUrl(savedItem.url);
      console.log(new Date().toLocaleString() + `: ${pid} - Finished processing request for posting Feed Item : ${caption}`);
      res.status(201).send(savedItem);
    });

export const FeedRouter: Router = router;
