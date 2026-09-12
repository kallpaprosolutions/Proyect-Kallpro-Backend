import { EventEmitter } from 'events';
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { parse as parseUrl } from 'url';
import { logger } from '../../lib/logger';

class CRMWebSocketChannel extends EventEmitter {
  private wss: WebSocketServer | null = null;
  // Map of channel -> Set<WebSocket>
  private channels = new Map<string, Set<WebSocket>>();

  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws/crm' });

    this.wss.on('connection', (ws, req) => {
      const { query } = parseUrl(req.url ?? '', true);
      const token = query.token as string;

      let userId: string | null = null;
      let companyId: string | null = null;

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as any;
        userId = payload.userId ?? payload.id;
        companyId = payload.companyId;
      } catch {
        ws.close(4001, 'Unauthorized');
        return;
      }

      // Subscribe to company-wide + user-specific channels
      const channelsToSubscribe = [
        `crm:pipeline:${companyId}`,
        `crm:agents:${companyId}`,
        `crm:inbox:company:${companyId}`,
        `crm:inbox:user:${userId}`,
      ];

      for (const ch of channelsToSubscribe) {
        if (!this.channels.has(ch)) this.channels.set(ch, new Set());
        this.channels.get(ch)!.add(ws);
      }

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
        } catch { /* ignore */ }
      });

      ws.on('close', () => {
        for (const subs of this.channels.values()) {
          subs.delete(ws);
        }
      });

      ws.send(JSON.stringify({ type: 'CONNECTED', userId, companyId }));
    });

    logger.info('[CRM-WS] WebSocket server initialized on /ws/crm');
  }

  emit(channel: string, event: string, payload: any): boolean {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) return false;

    const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    let sent = 0;

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sent++;
      }
    }

    return sent > 0;
  }
}

export const crmWS = new CRMWebSocketChannel();
export default crmWS;
