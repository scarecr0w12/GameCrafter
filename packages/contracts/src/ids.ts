import { randomBytes } from 'node:crypto';

export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type EventId = string & { readonly __brand: 'EventId' };

export function uuidv7(): string {
  const timestamp = BigInt(Date.now());
  const bytes = randomBytes(16);

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number((timestamp >> BigInt((5 - index) * 8)) & 0xffn);
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function brandId<T extends string>(value: string, name: string): T {
  if (!isUuid(value)) {
    throw new TypeError(`${name} must be a valid UUID`);
  }
  return value as T;
}

export function asProjectId(value: string): ProjectId {
  return brandId<ProjectId>(value, 'ProjectId');
}

export function asTaskId(value: string): TaskId {
  return brandId<TaskId>(value, 'TaskId');
}

export function asEventId(value: string): EventId {
  return brandId<EventId>(value, 'EventId');
}
