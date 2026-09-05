// ─── Forward port 8443 -> 3000 so both localhost:8443 and localhost:3000 work seamlessly
import net from 'node:net';

const server = net.createServer(socket => {
  const client = net.connect(3000, '127.0.0.1');
  socket.pipe(client);
  client.pipe(socket);
  socket.on('error', () => {});
  client.on('error', () => {});
});

server.listen(8443, '0.0.0.0', () => {
  console.log('Forwarding localhost:8443 -> localhost:3000');
});
