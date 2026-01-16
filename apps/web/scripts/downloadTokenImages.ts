import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSET_REGISTRY } from '../src/services/xcm-router/assetRegistry';

/**
 * Script to download token images from CoinGecko API
 * Stores images in apps/web/public/tokens/ directory
 */
async function downloadTokenImages() {
  const publicDir = join(process.cwd(), 'public');
  const tokensDir = join(publicDir, 'tokens');

  // Create tokens directory if it doesn't exist
  if (!existsSync(tokensDir)) {
    mkdirSync(tokensDir, { recursive: true });
    console.log(`Created directory: ${tokensDir}`);
  }

  // Get all unique coingeckoIds from asset registry
  const coingeckoIdMap = new Map<string, string>(); // coingeckoId -> symbol
  
  Object.entries(ASSET_REGISTRY).forEach(([symbol, entry]) => {
    if (entry.coingeckoId) {
      coingeckoIdMap.set(entry.coingeckoId, symbol);
    }
  });

  const coingeckoIds = Array.from(coingeckoIdMap.keys());

  if (coingeckoIds.length === 0) {
    console.log('No tokens with coingeckoId found in asset registry');
    return;
  }

  console.log(`Found ${coingeckoIds.length} tokens with coingeckoId`);
  console.log(`Tokens: ${Array.from(coingeckoIdMap.values()).join(', ')}`);

  // CoinGecko API allows up to 250 items per request
  const API_BASE = 'https://api.coingecko.com/api/v3';
  const apiKey = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
  
  try {
    // Fetch coin data with images
    const idsParam = coingeckoIds.join(',');
    const url = `${API_BASE}/coins/markets?vs_currency=usd&ids=${idsParam}&per_page=250${apiKey ? `&x_cg_demo_api_key=${apiKey}` : ''}`;

    console.log(`Fetching images from CoinGecko API...`);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('CoinGecko API rate limit exceeded. Please try again later.');
      }
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data: Array<{
      id: string;
      symbol: string;
      image: string;
    }> = await response.json();

    console.log(`\nDownloading ${data.length} token images...\n`);

    let successCount = 0;
    let failCount = 0;

    // Download each image
    for (const coin of data) {
      const symbol = coingeckoIdMap.get(coin.id);
      if (!symbol) {
        console.warn(`  ⚠️  No symbol found for coingeckoId: ${coin.id}`);
        failCount++;
        continue;
      }

      try {
        // Fetch the image
        const imageResponse = await fetch(coin.image);
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine file extension from URL (usually .png, sometimes .jpg)
        const urlExtension = coin.image.split('.').pop()?.split('?')[0] || 'png';
        const filename = `${symbol.toLowerCase()}.${urlExtension}`;
        const filepath = join(tokensDir, filename);

        // Write image to file
        writeFileSync(filepath, buffer);
        
        console.log(`  ✅ ${symbol} -> ${filename}`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to download ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failCount++;
      }
    }

    console.log(`\n✅ Download complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`\nImages saved to: ${tokensDir}`);
    console.log(`\nNext steps:`);
    console.log(`1. Update assetRegistry.ts to add logo paths`);
    console.log(`2. Update components to use the image paths`);
  } catch (error) {
    console.error('\n❌ Error downloading token images:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the script
downloadTokenImages().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});


