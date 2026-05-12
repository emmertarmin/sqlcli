import net from "node:net";
import { once } from "node:events";
import type { SessionRequest, SessionResponse } from "./types.js";

export async function sendSessionRequest(socketPath: string, request: SessionRequest): Promise<SessionResponse> {
  const socket = net.createConnection({ path: socketPath });
  socket.setEncoding("utf8");

  const response = await new Promise<SessionResponse>((resolve, reject) => {
    let buffer = "";

    socket.on("connect", () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex);
      try {
        resolve(JSON.parse(line) as SessionResponse);
      } catch (error) {
        reject(error);
      } finally {
        socket.end();
      }
    });

    socket.on("error", reject);
    socket.on("end", () => {
      if (buffer.length === 0) {
        reject(new Error("Session closed without responding"));
      }
    });
  });

  await once(socket, "close").catch(() => undefined);
  return response;
}
