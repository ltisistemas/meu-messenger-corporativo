import { buildServer } from './server.js';

export const server = buildServer();

// In standalone or local development, start the HTTP listener
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3001;
  const HOST = process.env.HOST || '0.0.0.0';

  server
    .listen({ port: PORT, host: HOST })
    .then(() => {
      console.log(`Server listening on http://${HOST}:${PORT}`);
    })
    .catch((err) => {
      server.log.error(err);
      process.exit(1);
    });
}

// Export default handler for Vercel Serverless Function lifecycle
export default async function handler(req: any, res: any) {
  await server.ready();
  server.server.emit('request', req, res);
}
