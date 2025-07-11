import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    console.log('🔄 Restarting chopsticks via Docker Compose...');
    
    // Use docker compose to restart the chopsticks service
    // Navigate to project root (../../ from apps/web)
    const projectRoot = path.join(process.cwd(), '../../');
    const { stdout, stderr } = await execAsync('docker compose -f docker-compose.dev.yml restart chopsticks', {
      cwd: projectRoot,
      timeout: 30000 // 30 second timeout
    });

    if (stderr && !stderr.toLowerCase().includes('warning')) {
      console.error('Docker compose stderr:', stderr);
      return NextResponse.json(
        { success: false, message: 'Docker restart failed', error: stderr },
        { status: 500 }
      );
    }

    console.log('✅ Chopsticks restart successful');
    return NextResponse.json({ 
      success: true, 
      message: 'Chopsticks restarted successfully',
      output: stdout
    });

  } catch (error) {
    console.error('💥 Error restarting chopsticks:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to restart chopsticks', 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 