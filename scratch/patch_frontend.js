const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const allFiles = [...walkSync('./app'), ...walkSync('./lib'), ...walkSync('./components')];

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Terminology Replacements (safe text only)
  content = content.replace(/>Enterprise Buyer</g, '>Commercial Buyer<');
  content = content.replace(/"Enterprise Buyer"/g, '"Commercial Buyer"');
  content = content.replace(/'Enterprise Buyer'/g, "'Commercial Buyer'");
  
  content = content.replace(/>Manual Seller Listing</g, '>Seller Listing<');
  
  content = content.replace(/>Bid</g, '>Purchase Offer<');
  content = content.replace(/>Bids</g, '>Purchase Offers<');
  content = content.replace(/"Bid"/g, '"Purchase Offer"');
  content = content.replace(/'Bid'/g, "'Purchase Offer'");
  content = content.replace(/>Place Bid</g, '>Submit Offer<');
  content = content.replace(/>My Bids</g, '>My Offers<');

  // 2. V8 Variable Rename
  // Only replace predictionId when used as a param or property key
  content = content.replace(/predictionId:/g, 'listingId:');
  content = content.replace(/predictionId,/g, 'listingId,');
  content = content.replace(/predictionId;/g, 'listingId;');
  content = content.replace(/predictionId /g, 'listingId ');
  content = content.replace(/predictionId\)/g, 'listingId)');
  content = content.replace(/p_prediction_id:/g, 'p_listing_id:');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

// Patch database.types.ts manually
const dbFile = './lib/database.types.ts';
let dbContent = fs.readFileSync(dbFile, 'utf8');
if (!dbContent.includes('bulk_offtake_listings')) {
  // Add bulk_offtake_listings
  const bol = `
      bulk_offtake_listings: {
        Row: {
          id: string
          seller_id: string
          farm_id: string | null
          crop_type: string
          listed_quantity: number
          quantity_unit: string
          asking_price_per_unit: number
          planting_date: string | null
          expected_harvest_at: string
          pickup_address: string | null
          pickup_latitude: number | null
          pickup_longitude: number | null
          seller_note: string | null
          listing_status: string
          harvest_available_at: string | null
          availability_source: string | null
          availability_declared_by: string | null
          evidence_status: string | null
          harvest_photo_url: string | null
          evidence_verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          farm_id?: string | null
          crop_type: string
          listed_quantity: number
          quantity_unit: string
          asking_price_per_unit: number
          planting_date?: string | null
          expected_harvest_at: string
          pickup_address?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          seller_note?: string | null
          listing_status?: string
          harvest_available_at?: string | null
          availability_source?: string | null
          availability_declared_by?: string | null
          evidence_status?: string | null
          harvest_photo_url?: string | null
          evidence_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['bulk_offtake_listings']['Insert']>
        Relationships: []
      }
`;
  dbContent = dbContent.replace(/Tables: {/, 'Tables: {' + bol);
}

// Update harvest_bids to use bulk_offtake_listing_id
dbContent = dbContent.replace(/prediction_id: string\n/g, 'listing_id: string | null\n          bulk_offtake_listing_id: string | null\n');

// Replace profession
dbContent = dbContent.replace(/'Enterprise Buyer'/g, "'Commercial Buyer'");

fs.writeFileSync(dbFile, dbContent, 'utf8');

console.log("Patch applied safely.");
