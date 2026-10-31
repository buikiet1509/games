import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AccessClaims, AccessTokens } from './accessToken';
import { HttpError } from '../lib/errors';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AccessClaims;
  }
}

/** preHandler yêu cầu header `Authorization: Bearer <access token>`. */
export function requireAuth(tokens: AccessTokens) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = token ? await tokens.verify(token) : null;
    if (!claims) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn');
    request.auth = claims;
  };
}
