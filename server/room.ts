import { Server, Socket } from 'socket.io';
import { fetchYoutubeVideo, getYoutubeVideoID } from './utils/youtube';



export class Room {
  // Serialized state
  public video: string | null = '';
  public videoTS = 0;
  public subtitle = '';
  private paused = false;
  private chat: ChatMessage[] = [];
  private nameMap: StringDict = {};
  private pictureMap: StringDict = {};
  public creator: string | undefined = undefined;
  public lock: string | undefined = undefined; // uid of the user who locked the room
  public playlist: PlaylistVideo[] = [];

  // Non-serialized state
  public roomId: string;
  public roster: User[] = [];
  private tsMap: NumberDict = {};
  private nextVotes: StringDict = {};
  private io: Server;
  private clientIdMap: StringDict = {};
  private uidMap: StringDict = {};
  private tsInterval: NodeJS.Timeout | undefined = undefined;
  public isChatDisabled: boolean | undefined = undefined;
  public lastUpdateTime: Date = new Date();

  constructor(
    io: Server,
    roomId: string,
    roomData?: string | null | undefined
  ) {
    this.roomId = roomId;
    this.io = io;

    if (roomData) {
      this.deserialize(roomData);
    }

    this.tsInterval = setInterval(() => {
      // console.log(roomId, this.video, this.roster, this.tsMap, this.nameMap);
      if (this.video) {
        io.of(roomId).emit('REC:tsMap', this.tsMap);
      }
    }, 1000);

    io.of(roomId).use(async (socket, next) => {
      // Validate the connector has the room password

      next();
    });
    io.of(roomId).on('connection', (socket: Socket) => {
      const clientId = socket.handshake.query?.clientId as string;
      this.clientIdMap[socket.id] = clientId;
      this.roster.push({ id: socket.id, clientId });

      socket.emit('REC:host', this.getHostState());
      socket.emit('REC:nameMap', this.nameMap);
      socket.emit('REC:pictureMap', this.pictureMap);
      socket.emit('REC:tsMap', this.tsMap);
      socket.emit('REC:lock', this.lock);
      socket.emit('chatinit', this.chat);
      socket.emit('playlist', this.playlist);
      io.of(roomId).emit('roster', this.getRosterForApp());

      socket.on('CMD:name', (data) => this.changeUserName(socket, data));
      socket.on('CMD:picture', (data) => this.changeUserPicture(socket, data));
      socket.on('CMD:uid', (data) => this.changeUserID(socket, data));
      socket.on('CMD:host', (data) => this.startHosting(socket, data));
      socket.on('CMD:play', () => this.playVideo(socket));
      socket.on('CMD:pause', () => this.pauseVideo(socket));
      socket.on('CMD:seek', (data) => this.seekVideo(socket, data));
      socket.on('CMD:ts', (data) => this.setTimestamp(socket, data));
      socket.on('CMD:chat', (data) => this.sendChatMessage(socket, data));
      socket.on('CMD:addReaction', (data) => this.addReaction(socket, data));
      socket.on('CMD:removeReaction', (data) =>
        this.removeReaction(socket, data)
      );
      socket.on('CMD:joinVideo', () => this.joinVideo(socket));
      socket.on('CMD:leaveVideo', () => this.leaveVideo(socket));
      socket.on('CMD:joinScreenShare', (data) =>
        this.joinScreenSharing(socket, data)
      );
      socket.on('CMD:leaveScreenShare', () => this.leaveScreenSharing(socket));
      socket.on('CMD:changeController', (data) =>
        this.changeController(socket, data)
      );
      socket.on('CMD:subtitle', (data) => this.addSubtitles(socket, data));
      socket.on('CMD:lock', (data) => this.lockRoom(socket, data));
      socket.on('CMD:askHost', () => {
        socket.emit('REC:host', this.getHostState());
      });
      
      socket.on('CMD:setRoomOwner', (data) => this.setRoomOwner(socket, data));
      socket.on('CMD:playlistNext', (data) => this.playlistNext(socket, data));
      socket.on('CMD:playlistAdd', (data) => this.playlistAdd(socket, data));
      socket.on('CMD:playlistMove', (data) => this.playlistMove(socket, data));
      socket.on('CMD:playlistDelete', (data) =>
        this.playlistDelete(socket, data)
      );

      socket.on('signal', (data) => this.sendSignal(socket, data));
      socket.on('signalSS', (data) => this.signalSS(socket, data));

      socket.on('kickUser', (data) => this.kickUser(socket, data));
      socket.on('CMD:deleteChatMessages', (data) =>
        this.deleteChatMessages(socket, data)
      );

      socket.on('disconnect', () => this.disconnectUser(socket));
    });
  }

  public serialize = () => {
    // Get the set of IDs with messages in chat
    // Only serialize roster and picture ID for those people, to save space
    const chatIDs = new Set(this.chat.map((msg) => msg.id));
    const abbrNameMap: StringDict = {};
    Object.keys(this.nameMap).forEach((id) => {
      if (chatIDs.has(id)) {
        abbrNameMap[id] = this.nameMap[id];
      }
    });
    const abbrPictureMap: StringDict = {};
    Object.keys(this.pictureMap).forEach((id) => {
      if (chatIDs.has(id)) {
        abbrPictureMap[id] = this.pictureMap[id];
      }
    });
    return JSON.stringify({
      video: this.video,
      videoTS: this.videoTS,
      subtitle: this.subtitle,
      paused: this.paused,
      chat: this.chat,
      nameMap: abbrNameMap,
      pictureMap: abbrPictureMap,
      lock: this.lock,
      creator: this.creator,
      playlist: this.playlist,
    });
  };

  private deserialize = (roomData: string) => {
    const roomObj = JSON.parse(roomData);
    this.video = roomObj.video;
    this.videoTS = roomObj.videoTS;
    if (roomObj.subtitle) {
      this.subtitle = roomObj.subtitle;
    }
    if (roomObj.paused) {
      this.paused = roomObj.paused;
    }
    if (roomObj.chat) {
      this.chat = roomObj.chat;
    }
    if (roomObj.nameMap) {
      this.nameMap = roomObj.nameMap;
    }
    if (roomObj.pictureMap) {
      this.pictureMap = roomObj.pictureMap;
    }
    if (roomObj.lock) {
      this.lock = roomObj.lock;
    }
    if (roomObj.creator) {
      this.creator = roomObj.creator;
    }
    if (roomObj.playlist) {
      this.playlist = roomObj.playlist;
    }
  };

  public saveRoom = async () => {
    this.lastUpdateTime = new Date();

  };

  public destroy = () => {
    if (this.tsInterval) {
      clearInterval(this.tsInterval);
    }
  };

  public getRosterForStats = () => {
    return this.roster.map((p) => ({
      name: this.nameMap[p.id] || p.id,
      uid: this.uidMap[p.id],
      ts: this.tsMap[p.id],
      clientId: this.clientIdMap[p.id],
      ip: this.io.of(this.roomId).sockets.get(p.id)?.request?.socket
        ?.remoteAddress,
    }));
  };

  protected getSharerId = (): string => {
    let sharerId = '';
    if (this.video?.startsWith('screenshare://')) {
      sharerId = this.video?.slice('screenshare://'.length);
    } else if (this.video?.startsWith('fileshare://')) {
      sharerId = this.video?.slice('fileshare://'.length);
    }
    return sharerId;
  };

  protected getRosterForApp = (): User[] => {
    return this.roster.map((p) => {
      return {
        ...p,
        isScreenShare: p.clientId === this.getSharerId(),
      };
    });
  };

  private getHostState = (): HostState => {
    // Reverse lookup the clientid to the socket id
    return {
      video: this.video ?? '',
      videoTS: this.videoTS,
      subtitle: this.subtitle,
      paused: this.paused,
    };
  };


  private cmdHost = (socket: Socket | null, data: string) => {
    this.video = data;
    this.videoTS = 0;
    this.paused = false;
    this.subtitle = '';
    this.tsMap = {};
    this.nextVotes = {};
    this.io.of(this.roomId).emit('REC:tsMap', this.tsMap);
    this.io.of(this.roomId).emit('REC:host', this.getHostState());
    if (socket && data) {
      const chatMsg = { id: socket.id, cmd: 'host', msg: data };
      this.addChatMessage(socket, chatMsg);
    }
    if (data === '') {
      this.playlistNext(null);
    }
  };

  public addChatMessage = (socket: Socket | null, chatMsg: ChatMessageBase) => {
    if (this.isChatDisabled && !chatMsg.cmd) {
      return;
    }
    const user = this.roster.find((user) => user.id === socket?.id);
    chatMsg.isSub = user?.isSub;
    const chatWithTime: ChatMessage = {
      ...chatMsg,
      timestamp: new Date().toISOString(),
      videoTS: socket ? this.tsMap[socket.id] : undefined,
    };
    this.chat.push(chatWithTime);
    this.chat = this.chat.splice(-100);
    this.io.of(this.roomId).emit('REC:chat', chatWithTime);
  };

  private validateLock = (socketId: string) => {
    if (!this.lock) {
      return true;
    }
    const result = this.uidMap[socketId] === this.lock;
    if (!result) {
      console.log('[VALIDATELOCK] failed', socketId);
    }
    return result;
  };


  private changeUserName = (socket: Socket, data: string) => {
    if (!data) {
      return;
    }
    if (data && data.length > 50) {
      return;
    }
    this.nameMap[socket.id] = data;
    this.io.of(this.roomId).emit('REC:nameMap', this.nameMap);
  };

  private changeUserPicture = (socket: Socket, data: string) => {
    if (data && data.length > 10000) {
      return;
    }
    this.pictureMap[socket.id] = data;
    this.io.of(this.roomId).emit('REC:pictureMap', this.pictureMap);
  };

  private changeUserID = async (
    socket: Socket,
    data: { uid: string; token: string }
  ) => {
    if (!data) {
      return;
    }
  };

  private startHosting = (socket: Socket, data: string) => {
    if (data && data.length > 20000) {
      return;
    }
    if (!this.validateLock(socket.id)) {
      return;
    }
    const sharer = this.getRosterForApp().find((user) => user.isScreenShare);
    if (sharer) {
      // Can't update the video while someone is screensharing/filesharing 
      return;
    }

    this.cmdHost(socket, data);
  };

  private playlistNext = (socket: Socket | null, data?: string) => {
    if (data && data.length > 20000) {
      return;
    }
    if (socket && data === this.video) {
      this.nextVotes[socket.id] = data;
    }
    const votes = this.roster.filter((user) => this.nextVotes[user.id]).length;
    if (!socket || votes >= Math.floor(this.roster.length / 2)) {
      const next = this.playlist.shift();
      this.io.of(this.roomId).emit('playlist', this.playlist);
      if (next) {
        this.cmdHost(null, next.url);
      }
    }
  };

  private playlistAdd = async (socket: Socket, data: string) => {
    if (data && data.length > 20000) {
      return;
    }

    const youtubeVideoId = getYoutubeVideoID(data);
    if (youtubeVideoId) {
      const video = await fetchYoutubeVideo(youtubeVideoId);
      this.playlist.push(video);
    } else {
      this.playlist.push({
        name: data,
        channel: 'Video URL',
        duration: 0,
        url: data,
      });
    }
    this.io.of(this.roomId).emit('playlist', this.playlist);
    const chatMsg = {
      id: socket.id,
      cmd: 'playlistAdd',
      msg: data,
    };
    this.addChatMessage(socket, chatMsg);
    if (!this.video) {
      this.playlistNext(null);
    }
  };

  private playlistDelete = (socket: Socket, index: number) => {
    if (index !== -1) {
      this.playlist.splice(index, 1);
      this.io.of(this.roomId).emit('playlist', this.playlist);
    }
  };

  private playlistMove = (
    socket: Socket,
    data: { index: number; toIndex: number }
  ) => {
    if (data.index !== -1) {
      const items = this.playlist.splice(data.index, 1);
      this.playlist.splice(data.toIndex, 0, items[0]);
      this.io.of(this.roomId).emit('playlist', this.playlist);
    }
  };

  private playVideo = (socket: Socket) => {
    if (!this.validateLock(socket.id)) {
      return;
    }
    socket.broadcast.emit('REC:play', this.video);
    const chatMsg = {
      id: socket.id,
      cmd: 'play',
      msg: this.tsMap[socket.id]?.toString(),
    };
    this.paused = false;
    this.addChatMessage(socket, chatMsg);
  };

  private pauseVideo = (socket: Socket) => {
    if (!this.validateLock(socket.id)) {
      return;
    }
    socket.broadcast.emit('REC:pause');
    const chatMsg = {
      id: socket.id,
      cmd: 'pause',
      msg: this.tsMap[socket.id]?.toString(),
    };
    this.paused = true;
    this.addChatMessage(socket, chatMsg);
  };

  private seekVideo = (socket: Socket, data: number) => {
    if (String(data).length > 100) {
      return;
    }
    if (!this.validateLock(socket.id)) {
      return;
    }
    this.videoTS = data;
    socket.broadcast.emit('REC:seek', data);
    const chatMsg = { id: socket.id, cmd: 'seek', msg: data?.toString() };
    this.addChatMessage(socket, chatMsg);
  };

  private setTimestamp = (socket: Socket, data: number) => {
    if (String(data).length > 100) {
      return;
    }
    if (data > this.videoTS) {
      this.videoTS = data;
    }
    this.tsMap[socket.id] = data;
  };

  private sendChatMessage = (socket: Socket, data: string) => {
    if (data && data.length > 10000) {
      return;
    }
    const chatMsg = { id: socket.id, msg: data };
    this.addChatMessage(socket, chatMsg);
  };

  private addReaction = (
    socket: Socket,
    data: { value: string; msgId: string; msgTimestamp: string }
  ) => {
    if (data.value.length > 2) {
      return;
    }
    const msg = this.chat.find(
      (m) => m.id === data.msgId && m.timestamp === data.msgTimestamp
    );
    if (!msg) {
      return;
    }
    msg.reactions = msg.reactions || {};
    msg.reactions[data.value] = msg.reactions[data.value] || [];

    if (!msg.reactions[data.value].includes(socket.id)) {
      msg.reactions[data.value].push(socket.id);
      const reaction: Reaction = { user: socket.id, ...data };
      this.io.of(this.roomId).emit('REC:addReaction', reaction);
    }
  };

  private removeReaction = (
    socket: Socket,
    data: { value: string; msgId: string; msgTimestamp: string }
  ) => {
    if (data.value.length > 2) {
      return;
    }
    const msg = this.chat.find(
      (m) => m.id === data.msgId && m.timestamp === data.msgTimestamp
    );
    if (!msg || !msg.reactions?.[data.value]) {
      return;
    }
    msg.reactions[data.value] = msg.reactions[data.value].filter(
      (id) => id !== socket.id
    );
    const reaction: Reaction = { user: socket.id, ...data };
    this.io.of(this.roomId).emit('REC:removeReaction', reaction);
  };

  private joinVideo = (socket: Socket) => {
    const match = this.roster.find((user) => user.id === socket.id);
    if (match) {
      match.isVideoChat = true;
    }
    this.io.of(this.roomId).emit('roster', this.getRosterForApp());
  };

  private leaveVideo = (socket: Socket) => {
    const match = this.roster.find((user) => user.id === socket.id);
    if (match) {
      match.isVideoChat = false;
    }
    this.io.of(this.roomId).emit('roster', this.getRosterForApp());
  };

  private joinScreenSharing = (socket: Socket, data: { file: boolean }) => {
    if (!this.validateLock(socket.id)) {
      return;
    }
    const sharer = this.getRosterForApp().find((user) => user.isScreenShare);
    if (sharer) {
      // Someone's already sharing
      return;
    }
    if (data && data.file) {
      this.cmdHost(socket, 'fileshare://' + this.clientIdMap[socket.id]);
    } else {
      this.cmdHost(socket, 'screenshare://' + this.clientIdMap[socket.id]);

    }
    this.io.of(this.roomId).emit('roster', this.getRosterForApp());
  };

  private leaveScreenSharing = (socket: Socket) => {
    const sharer = this.getRosterForApp().find((user) => user.isScreenShare);
    if (!sharer || sharer?.id !== socket.id) {
      return;
    }
    this.cmdHost(socket, '');
    this.io.of(this.roomId).emit('roster', this.getRosterForApp());
  };

  private changeController = (socket: Socket, data: string) => {
    if (data && data.length > 100) {
      return;
    }
    if (!this.validateLock(socket.id)) {
      return;
    }
  };

  private addSubtitles = async (socket: Socket, data: string) => {
    if (data && data.length > 10000) {
      return;
    }
    if (!this.validateLock(socket.id)) {
      return;
    }
    this.subtitle = data;
    this.io.of(this.roomId).emit('REC:subtitle', this.subtitle);
  };

  private lockRoom = async (
    socket: Socket,
    data: { uid: string; token: string; locked: boolean }
  ) => {
    if (!data) {
      return;
    }

    const chatMsg = {
      id: socket.id,
      cmd: data.locked ? 'lock' : 'unlock',
      msg: '',
    };
    this.addChatMessage(socket, chatMsg);
  };

  private setRoomOwner = async (
    socket: Socket,
    data: {
      uid: string;
      token: string;
      undo: boolean;
    }
  ) => {

    if (data.undo) {
      socket.emit('REC:getRoomState', {});
    } else {

      const roomObj: any = {
        roomId: this.roomId,
      };

    }
  };

  private sendSignal = (socket: Socket, data: { to: string; msg: string }) => {
    if (!data) {
      return;
    }
    const fromClientId = this.clientIdMap[socket.id];
    const toId = this.roster.find((p) => p.clientId === data.to)?.id;
    this.io
      .of(this.roomId)
      .to(toId ?? '')
      .emit('signal', { from: fromClientId, msg: data.msg });
  };

  private signalSS = (
    socket: Socket,
    data: { to: string; sharer: boolean; msg: string }
  ) => {
    if (!data) {
      return;
    }
    const fromClientId = this.clientIdMap[socket.id];
    const toId = this.roster.find((p) => p.clientId === data.to)?.id;
    this.io
      .of(this.roomId)
      .to(toId ?? '')
      .emit('signalSS', {
        from: fromClientId,
        sharer: data.sharer,
        msg: data.msg,
      });
  };

  private disconnectUser = (socket: Socket) => {
    let index = this.roster.findIndex((user) => user.id === socket.id);
    const removed = this.roster.splice(index, 1)[0];
    this.io.of(this.roomId).emit('roster', this.getRosterForApp());
    const wasSharer = removed.clientId === this.getSharerId();
    if (wasSharer) {
      // Reset the room state since we lost the screen sharer
      this.cmdHost(socket, '');
    }
    delete this.tsMap[socket.id];
    // delete nameMap[socket.id];
  };

  private kickUser = async (
    socket: Socket,
    data: {
      uid: string;
      token: string;
      userToBeKicked: string;
    }
  ) => {


    const userToBeKickedSocket = this.io
      .of(this.roomId)
      .sockets.get(data.userToBeKicked);
    if (userToBeKickedSocket) {
      try {
        userToBeKickedSocket.emit('kicked');
        userToBeKickedSocket.disconnect();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  private deleteChatMessages = async (
    socket: Socket,
    data: {
      author: string;
      timestamp: string | undefined;
      uid: string;
      token: string;
    }
  ) => {

    if (!data.timestamp && !data.author) {
      this.chat.length = 0;
    } else {
      this.chat = this.chat.filter((msg) => {
        if (data.timestamp) {
          return msg.id !== data.author || msg.timestamp !== data.timestamp;
        }
        return msg.id !== data.author;
      });
    }
    this.io.of(this.roomId).emit('chatinit', this.chat);
    return;
  };
}
