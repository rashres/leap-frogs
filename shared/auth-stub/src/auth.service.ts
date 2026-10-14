import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";

const ALLOWED_ROLES = ["USER", "MISSION_OPERATOR", "AUDIT", "ANALYST"] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

interface StoredUser {
  passwordHash: string;
  refreshToken: string | null;
  roles: UserRole[];
}

interface TokenPayload {
  sub: string;
  roles: UserRole[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly SECRET_KEY = this.getRequiredEnv("JWT_SECRET");
  private readonly ACCESS_TOKEN_EXPIRY = "15m";
  private readonly REFRESH_TOKEN_EXPIRY = "7d";
  private readonly BCRYPT_ROUNDS = 10;

  private readonly users = new Map<string, StoredUser>();

  async onModuleInit(): Promise<void> {
    await this.initializeTestUsers();
  }

  private async initializeTestUsers(): Promise<void> {
    const testPassword = process.env.AUTH_STUB_TEST_PASSWORD;
    if (!testPassword) {
      return;
    }

    const hashedPassword = await bcrypt.hash(testPassword, this.BCRYPT_ROUNDS);
    this.users.set("dave", {
      passwordHash: hashedPassword,
      refreshToken: null,
      roles: ["MISSION_OPERATOR"],
    });
    this.users.set("auditor", {
      passwordHash: hashedPassword,
      refreshToken: null,
      roles: ["AUDIT"],
    });
    this.users.set("analyst", {
      passwordHash: hashedPassword,
      refreshToken: null,
      roles: ["ANALYST"],
    });
  }

  async register(
    username: string,
    password: string,
    roles?: string[]
  ): Promise<{ username: string; roles: UserRole[]; registered: true }> {
    if (this.users.has(username)) {
      throw new ConflictException(`${username} is already registered`);
    }
    const normalizedRoles = this.normalizeRoles(roles);
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
    this.users.set(username, {
      passwordHash,
      refreshToken: null,
      roles: normalizedRoles,
    });
    return { username, roles: normalizedRoles, registered: true };
  }

  async login(username: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = this.users.get(username);
    if (!user) {
      throw new UnauthorizedException("invalid username or password");
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("invalid username or password");
    }

    const accessToken = this.issueToken(username, user.roles, this.ACCESS_TOKEN_EXPIRY);
    const refreshToken = this.issueToken(username, user.roles, this.REFRESH_TOKEN_EXPIRY);
    user.refreshToken = refreshToken;

    return { accessToken, refreshToken };
  }

  refresh(refreshToken: string): { accessToken: string } {
    const payload = this.validateToken(refreshToken);
    const entry = this.findByRefreshToken(refreshToken);
    if (!entry) {
      throw new UnauthorizedException("invalid or expired refresh token");
    }
    const [username] = entry;
    return { accessToken: this.issueToken(username, payload.roles, this.ACCESS_TOKEN_EXPIRY) };
  }

  logout(refreshToken: string): { loggedOut: true } {
    const entry = this.findByRefreshToken(refreshToken);
    if (!entry) {
      throw new UnauthorizedException("invalid or expired refresh token");
    }
    const [, user] = entry;
    user.refreshToken = null;
    return { loggedOut: true };
  }

  private issueToken(username: string, roles: UserRole[], expiresIn: jwt.SignOptions["expiresIn"]): string {
    return jwt.sign(
      { sub: username, roles },
      this.SECRET_KEY,
      { algorithm: "HS256", expiresIn }
    );
  }

  private validateToken(token: string): TokenPayload {
    return jwt.verify(token, this.SECRET_KEY) as TokenPayload;
  }

  private findByRefreshToken(refreshToken: string): [string, StoredUser] | undefined {
    return [...this.users.entries()].find(([, u]) => u.refreshToken === refreshToken);
  }

  private normalizeRoles(roles?: string[]): UserRole[] {
    if (!roles || roles.length === 0) {
      return ["USER"];
    }

    const uniqueRoles = [...new Set(roles)];
    const invalidRole = uniqueRoles.find((role) => !ALLOWED_ROLES.includes(role as UserRole));
    if (invalidRole) {
      throw new UnauthorizedException(`unsupported role: ${invalidRole}`);
    }

    return uniqueRoles as UserRole[];
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} environment variable is required`);
    }
    return value;
  }
}
