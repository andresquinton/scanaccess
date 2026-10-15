import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const events = sqliteTable('events', { id: text('id').primaryKey(), name: text('name').notNull(), created: text('created').notNull() });
export const people = sqliteTable('people', {event: text('event').notNull().references(()=>events.id), code:text('code').notNull(), name:text('name').notNull(), arrived:text('arrived'), device:text('device'), revision:integer('revision').notNull().default(0)},t=>[primaryKey({columns:[t.event,t.code]})]);
export const sheetSync = sqliteTable('sheet_sync', { code:text('code').primaryKey(), synced:text('synced') });
