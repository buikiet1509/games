import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'chua-an-lac';
export const ACCESS_TOKEN_TTL_SEC = 15 * 60;

export interface AccessClaims {
  userId: string;
  username: string;
}

export function createAccessTokens(secret: string) {
  const key = new TextEncoder().encode(secret);

  return {
    sign: (claims: AccessClaims) =>
      new SignJWT({ username: claims.username })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(claims.userId)
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_TTL_SEC}s`)
        .sign(key),

    /** Trả về claims nếu token hợp lệ, null nếu sai/hết hạn. Dùng cho cả HTTP và Colyseus onAuth. */
    async verify(token: string): Promise<AccessClaims | null> {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ['HS256'] });
        if (!payload.sub || typeof payload.username !== 'string') return null;
        return { userId: payload.sub, username: payload.username };
      } catch {
        return null;
      }
    },
  };
}

export type AccessTokens = ReturnType<typeof createAccessTokens>;
