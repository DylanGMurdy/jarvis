import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function migrate() {
  try {
    console.log('Starting migrations...');

    // Try to use RPC exec_sql first
    try {
      await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS approval_queue (
          id uuid default gen_random_uuid() primary key,
          project_id uuid references projects(id),
          project_title text,
          action_type text not null,
          description text not null,
          payload jsonb,
          status text default 'pending',
          created_at timestamp with time zone default now()
        )`
      });
      console.log('Created approval_queue table');

      await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_id text'
      });
      console.log('Added drive_folder_id column to projects');

      await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE projects ADD COLUMN IF NOT EXISTS war_room_completed_at timestamptz'
      });
      console.log('Added war_room_completed_at column to projects');

      await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS lindy_clients (
          id uuid default gen_random_uuid() primary key,
          name text not null,
          setup_paid boolean default false,
          monthly_active boolean default false,
          notes text,
          created_at timestamp with time zone default now()
        )`
      });
      console.log('Created lindy_clients table');

      console.log('✅ Migrations completed successfully');
    } catch (rpcError) {
      console.log('RPC exec_sql failed, testing connection with existing tables...');
      
      // Test connection by listing existing tables
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .limit(1);
      
      if (projectsError) {
        console.log('❌ Could not connect to projects table:', projectsError.message);
      } else {
        console.log('✅ Connection successful - projects table exists');
      }

      // Check other common tables
      const tables = ['tasks', 'users', 'approval_queue', 'lindy_clients'];
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          if (error) {
            console.log(`❌ Table '${table}' does not exist or is not accessible`);
          } else {
            console.log(`✅ Table '${table}' exists`);
          }
        } catch (tableError) {
          console.log(`❌ Error checking table '${table}':`, tableError);
        }
      }

      console.log('\n⚠️  Manual migration required:');
      console.log('Please run these SQL commands directly in Supabase SQL Editor:');
      console.log('\n1. CREATE TABLE IF NOT EXISTS approval_queue (');
      console.log('     id uuid default gen_random_uuid() primary key,');
      console.log('     project_id uuid references projects(id),');
      console.log('     project_title text,');
      console.log('     action_type text not null,');
      console.log('     description text not null,');
      console.log('     payload jsonb,');
      console.log('     status text default \'pending\',');
      console.log('     created_at timestamp with time zone default now()');
      console.log('   );');
      console.log('\n2. ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_id text;');
      console.log('\n3. ALTER TABLE projects ADD COLUMN IF NOT EXISTS war_room_completed_at timestamptz;');
      console.log('\n3. CREATE TABLE IF NOT EXISTS lindy_clients (');
      console.log('     id uuid default gen_random_uuid() primary key,');
      console.log('     name text not null,');
      console.log('     setup_paid boolean default false,');
      console.log('     monthly_active boolean default false,');
      console.log('     notes text,');
      console.log('     created_at timestamp with time zone default now()');
      console.log('   );');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();