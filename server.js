const { createApp } = require('./src/app');
const { host, port } = require('./src/config');
const server = createApp();
server.listen(port, host, () => console.log(`Mutual Care is running at http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
