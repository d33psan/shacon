import config from './config';
import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import Moniker from 'moniker';
import os from 'os';
import cors from 'cors';
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import { searchYoutube } from './utils/youtube';
import { Room } from './room';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import zlib from 'zlib';
import util from 'util';

const gzip = util.promisify(zlib.gzip);

const app = express();
let server: any = null;
if (config.HTTPS) {
  const key = fs.readFileSync(config.SSL_KEY_FILE as string);
  const cert = fs.readFileSync(config.SSL_CRT_FILE as string);
  server = https.createServer({ key: key, cert: cert }, app);
} else {
  server = new http.Server(app);
}
const io = new Server(server, { cors: {}, transports: ['websocket'] });



const names = Moniker.generator([
  Moniker.adjective,
  Moniker.noun,
  Moniker.verb,
]);
const launchTime = Number(new Date());
const rooms = new Map<string, Room>();
init();

async function init() {


  if (!rooms.has('/default')) {
    rooms.set('/default', new Room(io, '/default'));
  }

  server.listen(config.PORT, config.HOST);

  saveRooms();
  if (process.env.NODE_ENV === 'development') {
    require('./vmWorker');
    require('./syncSubs');
    require('./timeSeries');
  }
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'text/plain', limit: 1000000 }));

app.get('/ping', (_req, res) => {
  res.json('pong');
});

// Data's already compressed so go before the compression middleware
app.get('/subtitle/:hash', async (req, res) => {

  res.setHeader('Content-Encoding', 'gzip');

});

app.use(compression());

app.post('/subtitle', async (req, res) => {
  const data = req.body;

  // calculate hash, gzip and save to redis
  const hash = crypto
    .createHash('sha256')
    .update(data, 'utf8')
    .digest()
    .toString('hex');
  let gzipData = (await gzip(data)) as Buffer;
  
  return res.json({ hash });
});

app.get('/downloadSubtitles', async (req, res) => {
  const response = await axios.get(req.query.url as string, {
    responseType: 'arraybuffer',
  });
  res.append('Content-Encoding', 'gzip');
  res.append('Content-Type', 'text/plain');

  res.end(response.data);
});

app.get('/searchSubtitles', async (req, res) => {
  try {
    const title = req.query.title as string;
    const url = req.query.url as string;
    let subUrl = '';
    if (url) {
      const startResp = await axios({
        method: 'get',
        url: url,
        headers: {
          Range: 'bytes=0-65535',
        },
        responseType: 'arraybuffer',
      });
      const start = startResp.data;
      const size = Number(startResp.headers['content-range'].split('/')[1]);
      const endResp = await axios({
        method: 'get',
        url: url,
        headers: {
          Range: `bytes=${size - 65536}-`,
        },
        responseType: 'arraybuffer',
      });
      const end = endResp.data;
      // console.log(start, end, size);
      let hash = computeOpenSubtitlesHash(start, end, size);
      // hash = 'f65334e75574f00f';
      // Search API for subtitles by hash
      subUrl = `https://rest.opensubtitles.org/search/moviebytesize-${size}/moviehash-${hash}/sublanguageid-eng`;
    } else if (title) {
      subUrl = `https://rest.opensubtitles.org/search/query-${encodeURIComponent(
        title
      )}/sublanguageid-eng`;
    }
    console.log(subUrl);
    const response = await axios.get(subUrl, {
      headers: { 'User-Agent': 'VLSub 0.10.2' },
    });
    // console.log(response);
    const subtitles = response.data;
    res.json(subtitles);
  } catch (e: any) {
    console.error(e.message);
    res.json([]);
  }

});

app.get('/stats', async (req, res) => {
  if (req.query.key && req.query.key === config.STATS_KEY) {
    const stats = await getStats();
    res.json(stats);
  } else {
    return res.status(403).json({ error: 'Access Denied' });
  }
});



app.get('/youtube', async (req, res) => {
  if (typeof req.query.q === 'string') {
    try {

      const items = await searchYoutube(req.query.q);
      res.json(items);
    } catch {
      return res.status(500).json({ error: 'youtube error' });
    }
  } else {
    return res.status(500).json({ error: 'query must be a string' });
  }
});

app.post('/createRoom', async (req, res) => {
  const genName = () =>
    '/' + (config.SHARD ? `${config.SHARD}@` : '') + names.choose();
  let name = genName();
  // Keep retrying until no collision
  while (rooms.has(name)) {
    name = genName();
  }
  console.log('createRoom: ', name);
  const newRoom = new Room(io, name);

  newRoom.video = req.body?.video || '';
  rooms.set(name, newRoom);
  res.json({ name: name.slice(1) });
});

app.get('/resolveRoom/:vanity', async (req, res) => {
  const vanity = req.params.vanity;

});

app.use(express.static(config.BUILD_DIRECTORY));
// Send index.html for all other requests (SPA)
app.use('/*', (_req, res) => {
  res.sendFile(
    path.resolve(__dirname + `/../${config.BUILD_DIRECTORY}/index.html`)
  );
});

async function saveRooms() {
  while (true) {
    // console.time('[SAVEROOMS]');
    const roomArr = Array.from(rooms.values());
    for (let i = 0; i < roomArr.length; i++) {
      if (roomArr[i].roster.length) {
        await roomArr[i].saveRoom();
      }
    }
    // console.timeEnd('[SAVEROOMS]');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}


async function getStats() {
  let currentUsers = 0;
  let currentHttp = 0;
  let currentScreenShare = 0;
  let currentFileShare = 0;
  let currentVideoChat = 0;
  let currentRoomSizeCounts: NumberDict = {};
  let currentRoomCount = rooms.size;
  rooms.forEach((room) => {
    const obj = {
      video: room.video,
      rosterLength: room.roster.length,
      videoChats: room.roster.filter((p) => p.isVideoChat).length,
    };
    currentUsers += obj.rosterLength;
    currentVideoChat += obj.videoChats;

    if (obj.video?.startsWith('http') && obj.rosterLength) {
      currentHttp += 1;
    }
    if (obj.video?.startsWith('screenshare://') && obj.rosterLength) {
      currentScreenShare += 1;
    }
    if (obj.video?.startsWith('fileshare://') && obj.rosterLength) {
      currentFileShare += 1;
    }
    if (obj.rosterLength > 0) {
      if (!currentRoomSizeCounts[obj.rosterLength]) {
        currentRoomSizeCounts[obj.rosterLength] = 0;
      }
      currentRoomSizeCounts[obj.rosterLength] += 1;
    }
  });



  const uptime = Number(new Date()) - launchTime;
  const cpuUsage = os.loadavg();
  const memUsage = process.memoryUsage().rss;

  
  

  return {
    uptime,
    cpuUsage,
    memUsage,
    currentRoomCount,
    currentRoomSizeCounts,
    currentUsers,
    currentHttp,
    currentScreenShare,
    currentFileShare,
    currentVideoChat,
  };
}

function computeOpenSubtitlesHash(first: Buffer, last: Buffer, size: number) {
  let temp = BigInt(size);
  process(first);
  process(last);

  temp = temp & BigInt('0xffffffffffffffff');
  return temp.toString(16).padStart(16, '0');

  function process(chunk: Buffer) {
    for (let i = 0; i < chunk.length; i += 8) {
      const long = chunk.readBigUInt64LE(i);
      temp += long;
    }
  }
}
