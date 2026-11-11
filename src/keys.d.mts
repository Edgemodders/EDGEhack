// Types for keys.mjs, REDnode's shared key store library (REDnode #23, tools/keys/keys.mjs), copied
// unchanged beside this file. Only what EDGEhack uses.

export interface KeyInfo {
  service: string;
  name: string;
  set: boolean;
  source: "env" | "file" | null;
  env: string;
  last4: string | null;
  unreadable: boolean;
  updated: string | null;
  usedBy: { tool: string; at: string }[];
}

export const SERVICES: Record<string, { name: string; prefix?: string; env: string }>;
export function keysDir(): string;
export function envName(service: string): string;
export function checkKey(service: string, key: string): string | null;
export function getKey(service: string, opts?: { tool?: string }): string | undefined;
export function setKey(service: string, key: string): void;
export function hasKey(service: string): boolean;
export function removeKey(service: string): boolean;
export function keyInfo(service: string): KeyInfo;
export function listServices(): string[];
export const promises: {
  getKey(service: string, opts?: { tool?: string }): Promise<string | undefined>;
  setKey(service: string, key: string): Promise<void>;
  hasKey(service: string): Promise<boolean>;
  removeKey(service: string): Promise<boolean>;
  keyInfo(service: string): Promise<KeyInfo>;
};
