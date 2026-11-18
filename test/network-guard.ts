/**
 * Network guard, loaded before every test file in this package.
 *
 * A test may reach this machine's loopback addresses, a Unix socket, and
 * hosts under the reserved `.invalid` top-level domain (RFC 6761), which
 * never resolve. Every other host is refused before a TCP socket opens,
 * so no test, stub or mutation run can reach a real service over TCP or
 * fetch. It does not cover UDP or the `dns.resolve` calls, which this
 * package does not use. A guarded `fetch` rejects with `NetworkGuardError`. A guarded
 * socket is destroyed with that error on the next tick, as a refused
 * connection would be, so it reaches the caller the way a network failure
 * does, as the cause of fetch's own error.
 *
 * The guard wraps `globalThis.fetch` and patches `net.Socket.prototype.connect`.
 * A test that replaces `globalThis.fetch` with a fake keeps the socket
 * guard underneath it. When a socket aims at an allowed name rather than
 * an address, the guard also wraps the name lookup, so a resolver or a
 * hosts file that maps `localhost` or a `.invalid` name to an outside
 * address is refused the same way.
 */

import dns from 'node:dns';
import net from 'node:net';

const INSTALLED = Symbol.for('tsnomad.test-support.network-guard');

export class NetworkGuardError extends Error {
  constructor(public readonly host: string) {
    super(`Network guard: tests may not reach '${host}'. Use a loopback server or a host under .invalid.`);
    this.name = 'NetworkGuardError';
  }
}

/** True when a test may open a connection to `host`. */
export function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (h === 'localhost' || h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (h === 'invalid' || h.endsWith('.invalid')) return true;
  return false;
}

/** True for an address on this machine's loopback interface. */
export function isLoopbackAddress(address: string): boolean {
  const a = address.toLowerCase().replace(/^::ffff:/, '');
  return a === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a);
}

type LookupCallback = (error: Error | null, address?: unknown, family?: number) => void;
type Lookup = (hostname: string, options: unknown, callback: LookupCallback) => void;

/** Wraps a lookup so that any answer outside loopback fails with NetworkGuardError. */
function guardLookup(lookup: Lookup): Lookup {
  return (hostname, options, callback) => {
    const done = (typeof options === 'function' ? options : callback) as LookupCallback;
    const opts = typeof options === 'function' ? {} : options;
    lookup(hostname, opts, (error, address, family) => {
      if (error) return done(error);
      if (address === undefined || address === null) return done(new Error(`Network guard: the lookup for '${hostname}' answered no address`));
      const answers = Array.isArray(address) ? address.map((a: { address: string }) => a.address) : [String(address)];
      const outside = answers.find((a) => !isLoopbackAddress(a));
      if (outside !== undefined) return done(new NetworkGuardError(`${hostname} (${outside})`));
      done(null, address, family);
    });
  };
}

/** The host a `Socket.connect` call aims at, or null for a Unix socket path. */
function connectTarget(args: unknown[]): string | null {
  const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0];
  if (first !== null && typeof first === 'object') {
    const options = first as { path?: unknown; host?: unknown };
    if (typeof options.path === 'string') return null;
    return typeof options.host === 'string' && options.host !== '' ? options.host : 'localhost';
  }
  if (typeof first === 'string' && !/^\d+$/.test(first)) return null;
  const host = args[1];
  return typeof host === 'string' && host !== '' ? host : 'localhost';
}

/** The same connect arguments, in options form, with the lookup wrapped. */
function withGuardedLookup(args: unknown[]): unknown[] {
  if (Array.isArray(args[0])) {
    // net.connect hands the socket its arguments already normalized, as an
    // array Node marks with a symbol. The copy keeps that mark.
    const original = args[0] as unknown[] & Record<symbol, unknown>;
    const copy = [...original] as unknown[] & Record<symbol, unknown>;
    for (const mark of Object.getOwnPropertySymbols(original)) copy[mark] = original[mark];
    copy[0] = withLookup(copy[0] as Record<string, unknown>);
    return [copy, ...args.slice(1)];
  }
  if (args[0] !== null && typeof args[0] === 'object') {
    return [withLookup(args[0] as Record<string, unknown>), ...args.slice(1)];
  }
  return [withLookup({ port: args[0], host: args[1] }), ...args.slice(2).filter((a) => typeof a === 'function')];
}

function withLookup(options: Record<string, unknown>): Record<string, unknown> {
  return { ...options, lookup: guardLookup((options.lookup as Lookup | undefined) ?? (dns.lookup as unknown as Lookup)) };
}

function install(): void {
  const g = globalThis as Record<symbol, unknown>;
  if (g[INSTALLED]) return;
  g[INSTALLED] = true;

  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedConnect(this: net.Socket, ...args: unknown[]) {
    const host = connectTarget(args);
    if (host !== null && !isAllowedHost(host)) {
      const error = new NetworkGuardError(host);
      process.nextTick(() => this.destroy(error));
      return this;
    }
    if (host !== null && net.isIP(host.replace(/^\[|\]$/g, '')) === 0) {
      args = withGuardedLookup(args);
    }
    return (connect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;

  const realFetch = globalThis.fetch;
  globalThis.fetch = async function guardedFetch(input: string | URL | Request, init?: RequestInit) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!isAllowedHost(url.hostname)) throw new NetworkGuardError(url.hostname);
    return realFetch(input, init);
  } as typeof fetch;
}

install();
