const { io } = require("socket.io-client");

async function run() {
  // 1. Create User A
  const resA = await fetch("http://localhost:5000/api/v1/auth/web-guest", { method: "POST" });
  const dataA = await resA.json();
  const tokenA = dataA.token;
  const userIdA = dataA.data._id;
  console.log("User A:", userIdA);

  // 2. Create User B
  const resB = await fetch("http://localhost:5000/api/v1/auth/web-guest", { method: "POST" });
  const dataB = await resB.json();
  const tokenB = dataB.token;
  const userIdB = dataB.data._id;
  console.log("User B:", userIdB);

  // 3. Connect Sockets
  const socketA = io("http://localhost:5000", { auth: { token: tokenA } });
  const socketB = io("http://localhost:5000", { auth: { token: tokenB } });

  socketA.on("connect", () => console.log("Socket A connected"));
  socketB.on("connect", () => {
    console.log("Socket B connected");
    
    // User A sends request to User B
    setTimeout(() => {
      console.log("A emitting to B...");
      socketA.emit("ride:connect_request", {
        toUserId: userIdB,
        toDestination: "Test Dest",
        requestId: "req123"
      });
    }, 1000);
  });

  socketB.on("ride:connect_request_incoming", (payload) => {
    console.log("SUCCESS! User B received request:", payload);
    
    // Test response
    socketB.emit("ride:connect_response", {
      toUserId: payload.fromUserId,
      decision: "accepted",
      requestId: payload.requestId
    });
  });

  socketA.on("ride:connect_response_result", (payload) => {
    console.log("SUCCESS! User A received response:", payload);
    process.exit(0);
  });

  socketA.on("error", (e) => console.log("A Error:", e));
  socketB.on("error", (e) => console.log("B Error:", e));

  setTimeout(() => {
    console.error("TIMEOUT! Did not receive events.");
    process.exit(1);
  }, 5000);
}

run();
