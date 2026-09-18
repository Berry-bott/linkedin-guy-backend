const http = require('http');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); } catch (e) { resolve({ raw: chunks }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const payload = {
    email: "uniquetest17897@example.com",
    password: "SomePassword123!",
    name: "Nicholas Henry",
    phone: "0807432109"
  };

  console.log("=== 1. Fresh registration (expect 200/201) ===");
  console.log(JSON.stringify(await postJson("/api/auth/register", payload), null, 2));

  console.log("\n=== 2. Duplicate email (expect EMAIL_IN_USE with errors) ===");
  console.log(JSON.stringify(await postJson("/api/auth/register", { ...payload, email: "uniquetest17897@example.com", phone: "0807432110" }), null, 2));

  console.log("\n=== 3. Duplicate phone (expect PHONE_IN_USE with errors) ===");
  console.log(JSON.stringify(await postJson("/api/auth/register", { ...payload, email: "other17897@example.com", phone: "0807432109" }), null, 2));

  console.log("\n=== 4. Empty body (expect VALIDATION_ERROR with errors) ===");
      console.log(JSON.stringify(await postJson("/api/auth/register", {}), null, 2));

  console.log("\n=== 5. Invalid email + weak password + bad phone ===");
  console.log(JSON.stringify(await postJson("/api/auth/register", { email: "notanemail", password: "123", name: "A", phone: "abc" }), null, 2));
})();
