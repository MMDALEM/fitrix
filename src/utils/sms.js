const https = require("https");

exports.sendCode = async (phone, code) => {
  const data = JSON.stringify({
    bodyId: 469148,
    to: phone,
    args: [code],
  });

  const options = {
    hostname: "console.melipayamak.com",
    port: 443,
    path: "/api/send/shared/1fa3df8e7b374542b04e216196e18fe7",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const req = https.request(options, (res) => {
    res.on("data", (d) => {
      process.stdout.write(d);
    });
  });

  req.on("error", (error) => {
    console.error(error);
  });

  req.write(data);
  req.end();
};

exports.successpayment = async (phone, number) => {
  const data = JSON.stringify({
    bodyId: 489288,
    to: phone,
    args: [number],
  });

  const options = {
    hostname: "console.melipayamak.com",
    port: 443,
    path: "/api/send/shared/1fa3df8e7b374542b04e216196e18fe7",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const req = https.request(options, (res) => {
    res.on("data", (d) => {
      process.stdout.write(d);
    });
  });

  req.on("error", (error) => {
    console.error(error);
  });

  req.write(data);
  req.end();
};

exports.manager = async (phone, number) => {
  const data = JSON.stringify({
    bodyId: 489300,
    to: phone,
    args: [number],
  });

  const options = {
    hostname: "console.melipayamak.com",
    port: 443,
    path: "/api/send/shared/1fa3df8e7b374542b04e216196e18fe7",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const req = https.request(options, (res) => {
    res.on("data", (d) => {
      process.stdout.write(d);
    });
  });

  req.on("error", (error) => {
    console.error(error);
  });

  req.write(data);
  req.end();
};
