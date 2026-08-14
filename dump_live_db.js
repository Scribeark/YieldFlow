const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

// We need the postgres connection string, not just the REST API URL.
// Does .env.local contain DATABASE_URL? Let's check.
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

async function main() {
    if (!dbUrl) {
        console.log("No DB URL found in environment.");
        console.log("Keys available:", Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB') || k.includes('POSTGRES')));
        return;
    }
    
    const client = new Client({
        connectionString: dbUrl,
    });
    
    try {
        await client.connect();
        
        const res = await client.query(`
            SELECT p.proname, pg_get_functiondef(p.oid) AS definition
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
            AND p.proname IN (
                'rpc_allocate_harvest_bid',
                'rpc_cancel_provisional_agreement',
                'rpc_declare_harvest_available',
                'rpc_convert_bids_to_trades',
                'rpc_accept_offer',
                'rpc_reject_offer',
                'rpc_withdraw_offer',
                'rpc_place_harvest_bid',
                'rpc_counter_harvest_bid'
            );
        `);
        
        for (const row of res.rows) {
            console.log('--- ' + row.proname + ' ---');
            console.log(row.definition);
            console.log('\n');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
