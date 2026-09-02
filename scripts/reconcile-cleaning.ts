import { loadEnv } from '../server/env';
import { readAll as readAllRooms } from '../src/lib/google-sheets/rooms.repository';
import { create, query } from '../src/lib/google-sheets/cleaning.repository';

loadEnv('.env');

const spreadsheetId = process.env.SPREADSHEET_ID;
if (!spreadsheetId) throw new Error('SPREADSHEET_ID is required');

const apply = process.argv.includes('--apply');
const rooms = await readAllRooms(spreadsheetId);
const roomsNeedingCleaning = rooms.filter(room => room.status === 'needs_cleaning');
let created = 0;

for (const room of roomsNeedingCleaning) {
  const tasks = await query(spreadsheetId, { roomId: room.roomId });
  const hasActiveTask = tasks.some(task =>
    task.status === 'pending' || task.status === 'in_progress',
  );

  if (hasActiveTask) continue;

  console.log(`${apply ? 'Creating' : 'Would create'} cleaning task for ${room.name} (${room.roomId})`);
  if (!apply) continue;

  await create(spreadsheetId, {
    roomId: room.roomId,
    scheduledAt: new Date().toISOString(),
    status: 'pending',
    priority: 'high',
    note: 'Reconciled task for a room awaiting cleaning',
  });
  created++;
}

console.log(apply ? `Created ${created} cleaning task(s).` : 'Dry run complete. Pass --apply to create the listed tasks.');
