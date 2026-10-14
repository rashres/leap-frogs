import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../src/auth.service";

function createService(secret = `unit-test-${Date.now()}-${Math.random()}`): AuthService {
  process.env.JWT_SECRET = secret;
  delete process.env.AUTH_STUB_TEST_PASSWORD;
  return new AuthService();
}

test("requires JWT_SECRET", () => {
  const previousSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  assert.throws(() => new AuthService(), /JWT_SECRET environment variable is required/);

  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
});

test("registers a user with default USER role", async () => {
  const service = createService();

  const result = await service.register("alice", "correct-horse-battery", undefined);

  assert.deepEqual(result, {
    username: "alice",
    roles: ["USER"],
    registered: true,
  });
});

test("rejects duplicate users and unsupported roles", async () => {
  const service = createService();
  await service.register("alice", "correct-horse-battery");

  await assert.rejects(
    service.register("alice", "another-password"),
    (error: unknown) => error instanceof ConflictException
  );
  await assert.rejects(
    service.register("bob", "correct-horse-battery", ["ADMIN"]),
    (error: unknown) => error instanceof UnauthorizedException
  );
});

test("logs in and issues verifiable access and refresh tokens", async () => {
  const secret = "unit-test-token-secret";
  const service = createService(secret);
  await service.register("alice", "correct-horse-battery", ["ANALYST"]);

  const tokens = await service.login("alice", "correct-horse-battery");
  const accessPayload = jwt.verify(tokens.accessToken, secret) as jwt.JwtPayload & { roles: string[] };
  const refreshPayload = jwt.verify(tokens.refreshToken, secret) as jwt.JwtPayload & { roles: string[] };

  assert.equal(accessPayload.sub, "alice");
  assert.deepEqual(accessPayload.roles, ["ANALYST"]);
  assert.equal(refreshPayload.sub, "alice");
  assert.deepEqual(refreshPayload.roles, ["ANALYST"]);
});

test("rejects unknown users and incorrect passwords", async () => {
  const service = createService();
  await service.register("alice", "correct-horse-battery");

  await assert.rejects(service.login("missing", "correct-horse-battery"), UnauthorizedException);
  await assert.rejects(service.login("alice", "incorrect-password"), UnauthorizedException);
});

test("refreshes tokens and invalidates the refresh token on logout", async () => {
  const service = createService();
  await service.register("alice", "correct-horse-battery");
  const tokens = await service.login("alice", "correct-horse-battery");

  const refreshed = service.refresh(tokens.refreshToken);
  assert.ok(refreshed.accessToken);
  assert.deepEqual(jwt.verify(refreshed.accessToken, process.env.JWT_SECRET!), {
    sub: "alice",
    roles: ["USER"],
    iat: jwt.decode(tokens.accessToken)?.iat,
    exp: jwt.decode(tokens.accessToken)?.exp,
  });

  assert.deepEqual(service.logout(tokens.refreshToken), { loggedOut: true });
  assert.throws(() => service.refresh(tokens.refreshToken), UnauthorizedException);
  assert.throws(() => service.logout(tokens.refreshToken), UnauthorizedException);
});