require('dotenv').config();

const defaults = {
  YOUTUBE_API_KEY: '', // Optional, provide one to enable searching YouTube
  NODE_ENV: '', // Usually, you should let process.env.NODE_ENV override this
  HTTPS: '', // Optional, Set to use HTTPS on the server
  SSL_KEY_FILE: '', // Optional, Filename of SSL key
  SSL_CRT_FILE: '', // Optional, Filename of SSL cert
  PORT: 8080, // Port to use for server
  HOST: '0.0.0.0', // Host interface to bind server to
  STATS_KEY: '', // Secret string to validate viewing stats
  CUSTOM_SETTINGS_HOSTNAME: '', // Hostname to send different config settings to client
  STREAM_PATH: '', // Path of server that supports additional video streams
  ROOM_CAPACITY: 0, // Maximum capacity of a standard room. Set to 0 for unlimited.
  ROOM_CAPACITY_SUB: 0, // Maximum capacity of a sub room. Set to 0 for unlimited.
  BUILD_DIRECTORY: 'build', // Name of the directory where the built React UI is served from
  SHARD: undefined, // Shard ID of the web server (configure in ecosystem.config.js)
};

export default {
  ...defaults,
  ...process.env,
};
