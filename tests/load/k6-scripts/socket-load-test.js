import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp-up to 100 users over 30s
    { duration: '1m', target: 300 },  // Ramp-up to 300 users over 1m
    { duration: '2m', target: 1000 }, // Ramp-up to 1000 users over 2m
    { duration: '3m', target: 1000 }, // Hold at 1000 users for 3m
    { duration: '30s', target: 0 },   // Scale down
  ],
};

const BASE_LAT = 34.0522;
const BASE_LNG = -118.2437; // Los Angeles rough coordinates

export default function () {
  const url = 'ws://localhost:3001/';
  const params = { tags: { my_tag: 'load_test' } };

  const userId = `load_test_${__VU}`;
  const username = `Tester_${__VU}`;
  
  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      // Send initial location
      socket.send(JSON.stringify({
        type: 'location_update',
        user_id: userId,
        username: username,
        auth_token: '', // Local dev bypasses auth token
        vibeEmoji: '🤖',
        lat: BASE_LAT + (Math.random() - 0.5) * 0.1,
        lng: BASE_LNG + (Math.random() - 0.5) * 0.1,
      }));

      // Request chats
      socket.send(JSON.stringify({
        type: 'request_chats',
        user_id: userId
      }));

      // Send periodic location updates every 5-15 seconds
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'location_update',
          user_id: userId,
          username: username,
          auth_token: '',
          lat: BASE_LAT + (Math.random() - 0.5) * 0.1,
          lng: BASE_LNG + (Math.random() - 0.5) * 0.1,
        }));
      }, randomIntBetween(5000, 15000));
    });

    socket.on('message', (data) => {
      // Just parsing to ensure the JSON is valid and server is responding
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'sync') {
          // Sync payload
        }
      } catch (e) {
        console.error("Failed to parse message:", data);
      }
    });

    socket.on('close', () => console.log('disconnected'));
    socket.on('error', (e) => {
      if (e.error() != 'websocket: close sent') {
        console.error('An unexpected error occurred: ', e.error());
      }
    });

    // Close the socket after the test duration
    socket.setTimeout(function () {
      socket.close();
    }, 600000); // 10 minutes max per VU
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
