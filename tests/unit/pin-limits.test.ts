import { describe, expect, it } from "vitest";
import { PIN_LIMITS, checkPinLimits, pinBlockedMessage, type PinAttempt } from "@/lib/pin-limits";
import { clientIp, createDeviceToken, pinClientKey } from "@/server/client-key";
import type { Env } from "@/server/env";

const MIN = 60_000;
const now = Date.UTC(2026, 9, 19, 12, 0, 0);
const tries = (clientKey: string, n: number, minutesAgo = 0): PinAttempt[] =>
  Array.from({ length: n }, (_, i) => ({ clientKey, at: now - minutesAgo * MIN - i * 1000 }));

describe("wrong-PIN limits", () => {
  it("allows up to 4 wrong PINs from a device, blocks at 5 for 15 minutes", () => {
    expect(checkPinLimits(tries("ip:a", 4), "ip:a", now)).toEqual({ allowed: true });
    const r = checkPinLimits(tries("ip:a", 5), "ip:a", now);
    expect(r).toMatchObject({ allowed: false, scope: "client" });
    // the 5th most recent attempt was 4 s ago -> 15 min minus 4 s
    expect(r.allowed === false && r.retryAfterSeconds).toBe(15 * 60 - 4);
  });

  it("a stranger's wrong PINs don't block another device or IP", () => {
    expect(checkPinLimits(tries("ip:stranger", 5), "device:mine", now)).toEqual({ allowed: true });
    expect(checkPinLimits(tries("ip:stranger", 5), "ip:other", now)).toEqual({ allowed: true });
  });

  it("wrong PINs older than 15 minutes stop counting for the device", () => {
    expect(checkPinLimits(tries("ip:a", 5, 16), "ip:a", now)).toEqual({ allowed: true });
    expect(checkPinLimits([...tries("ip:a", 3, 16), ...tries("ip:a", 4)], "ip:a", now)).toEqual({ allowed: true });
  });

  it("20 wrong PINs from anywhere in an hour block everyone", () => {
    const spread = ["ip:1", "ip:2", "ip:3", "ip:4", "ip:5"].flatMap((ip) => tries(ip, 4, 30));
    expect(spread).toHaveLength(20);
    const r = checkPinLimits(spread, "device:mine", now);
    expect(r).toMatchObject({ allowed: false, scope: "global" });
    expect(r.allowed === false && r.retryAfterSeconds).toBeGreaterThan(29 * 60);
    expect(checkPinLimits(spread.slice(1), "device:mine", now)).toEqual({ allowed: true });
  });

  it("the global window is one hour", () => {
    const old = ["ip:1", "ip:2", "ip:3", "ip:4", "ip:5"].flatMap((ip) => tries(ip, 4, 61));
    expect(checkPinLimits(old, "device:mine", now)).toEqual({ allowed: true });
  });

  it("the device limit is checked before the global one", () => {
    const r = checkPinLimits([...tries("ip:a", 5), ...tries("ip:b", 15)], "ip:a", now);
    expect(r).toMatchObject({ scope: "client" });
  });

  it("limits match the brief", () => {
    expect(PIN_LIMITS).toEqual({ clientMax: 5, clientMinutes: 15, globalMax: 20, globalMinutes: 60 });
  });

  it("messages", () => {
    expect(pinBlockedMessage("client", 900)).toBe("Too many wrong PINs from this device. Try again in 15 min.");
    expect(pinBlockedMessage("global", 61)).toBe("Too many wrong PINs right now. Try again in 2 min.");
    expect(pinBlockedMessage("client", 5)).toBe("Too many wrong PINs from this device. Try again in 1 min.");
  });
});

describe("device and IP keys", () => {
  const env = { sessionSecret: new TextEncoder().encode("unit-test-secret-0123456789abcdefghij") } as Env;
  const otherEnv = { sessionSecret: new TextEncoder().encode("another-secret-0123456789abcdefghijkl") } as Env;
  const h = (init: Record<string, string>) => new Headers(init);

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(h({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.5");
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("keys by hashed IP, never the raw IP", async () => {
    const a = await pinClientKey(h({ "x-real-ip": "203.0.113.5" }), undefined, env);
    const b = await pinClientKey(h({ "x-real-ip": "203.0.113.6" }), undefined, env);
    expect(a.trusted).toBe(false);
    expect(a.key).toMatch(/^ip:[\w-]{32}$/);
    expect(a.key).not.toContain("203.0.113.5");
    expect(a.key).not.toBe(b.key);
    expect((await pinClientKey(h({ "x-real-ip": "203.0.113.5" }), undefined, env)).key).toBe(a.key);
  });

  it("a signed device cookie gets its own key, the same on any network", async () => {
    const token = await createDeviceToken(env);
    const home = await pinClientKey(h({ "x-real-ip": "203.0.113.5" }), token, env);
    const office = await pinClientKey(h({ "x-real-ip": "198.51.100.9" }), token, env);
    expect(home.trusted).toBe(true);
    expect(home.key).toMatch(/^device:/);
    expect(office.key).toBe(home.key);
  });

  it("a forged or foreign device cookie is ignored (falls back to IP)", async () => {
    const foreign = await createDeviceToken(otherEnv);
    const r = await pinClientKey(h({ "x-real-ip": "203.0.113.5" }), foreign, env);
    expect(r.trusted).toBe(false);
    expect((await pinClientKey(h({ "x-real-ip": "203.0.113.5" }), "not-a-token", env)).trusted).toBe(false);
  });
});
