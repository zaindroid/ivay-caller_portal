import AsteriskManager from "asterisk-manager";

// Ported from the caller_agent prototype's dialer/index.js AMI connection
// setup. Held as a module-level singleton (guarded against Next.js dev
// hot-reload) because this is a long-lived Asterisk Manager Interface
// socket, not a per-request resource.

type AmiConnection = InstanceType<typeof AsteriskManager>;

const globalForAmi = globalThis as unknown as {
  ami?: AmiConnection;
  amiConnected?: boolean;
};

function connect(): AmiConnection {
  const host = process.env.AMI_HOST || "127.0.0.1";
  const port = parseInt(process.env.AMI_PORT || "5038", 10);
  const user = process.env.AMI_USER || "dialer";
  const pass = process.env.AMI_PASS || "";

  const conn = new AsteriskManager(port, host, user, pass, true);
  conn.keepConnected();

  conn.on("connect", () => {
    globalForAmi.amiConnected = true;
  });
  conn.on("disconnect", () => {
    globalForAmi.amiConnected = false;
  });
  conn.on("error", () => {
    globalForAmi.amiConnected = false;
  });

  return conn;
}

export const ami = globalForAmi.ami ?? (globalForAmi.ami = connect());

export function isAmiConnected() {
  return globalForAmi.amiConnected ?? false;
}
