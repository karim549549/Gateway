import axios from "axios";

// Gateway endpoint
const URL = "http://localhost:3000/api/service1";

// Number of concurrent clients
const CLIENTS = 5;

const clients = ["karim", "rahim", "sabbir", "jamal", "babul"];

// Interval between requests (ms)
const INTERVAL = 220000;

async function makeRequest(clientId: number) {
  try {
    const res = await axios.get(URL, {
      headers: { "X-Client-ID": clients[clientId - 1] || `client${clientId}` },
    });
    console.log(`Client ${clientId}:`, res.data);
  } catch (err: any) {
    console.error(`Client ${clientId} error:`, err.message);
  }
}

function startLoad() {
  for (let i = 1; i <= CLIENTS; i++) {
    setInterval(() => makeRequest(i), INTERVAL);
  }
}

startLoad();
