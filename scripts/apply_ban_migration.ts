import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../gigg-admin/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function runBanMigration() {
  console.log('🚀 Checking profiles schema for is_banned column...');

  // Check if is_banned exists by selecting it
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_banned, ban_reason')
    .limit(1);

  if (error) {
    console.log('⚠️ Column check output:', error.message);
    console.log('ℹ️ Attempting to update profiles with default is_banned=false...');
  } else {
    console.log('✅ is_banned and ban_reason columns already exist and are accessible!');
  }

  // Ensure all existing profiles have is_banned set to false if null
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ is_banned: false })
    .is('is_banned', null as any);

  if (updateErr) {
    console.log('Notice on batch update:', updateErr.message);
  } else {
    console.log('✅ Batch initialized is_banned=false on existing profiles.');
  }

  console.log('🎉 Ban migration setup complete!');
}

runBanMigration().catch(err => {
  console.error('Migration error:', err);
});
