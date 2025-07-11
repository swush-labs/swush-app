import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Dynamic chopsticks URLs based on environment
    const CHOPSTICKS_HOST = process.env.NEXT_PUBLIC_CHOPSTICKS_HOST || 'localhost';
    const USE_HTTPS = process.env.NEXT_PUBLIC_USE_HTTPS === 'true';
    const WS_PROTOCOL = USE_HTTPS ? 'wss' : 'ws';
    
    // Use nginx proxy paths for production (HTTPS) or direct ports for development
    const endpoints = [
      USE_HTTPS 
        ? `${WS_PROTOCOL}://${CHOPSTICKS_HOST}/3421` 
        : `${WS_PROTOCOL}://${CHOPSTICKS_HOST}:3421`, // Asset Hub
      USE_HTTPS 
        ? `${WS_PROTOCOL}://${CHOPSTICKS_HOST}/3422` 
        : `${WS_PROTOCOL}://${CHOPSTICKS_HOST}:3422`  // Hydration
    ];

    // Test WebSocket connections with Docker-friendly timeout
    const healthChecks = endpoints.map(endpoint => 
      new Promise((resolve) => {
        const ws = new WebSocket(endpoint);
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000); // Increased timeout for Docker containers

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      })
    );

    const results = await Promise.all(healthChecks);

    //both must be healthy
    const isHealthy = results.every(result => result === true);

    if (isHealthy) {
      return NextResponse.json({ 
        status: 'healthy',
        endpoints: endpoints.map((endpoint, i) => ({
          endpoint,
          healthy: results[i]
        }))
      });
    } else {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          endpoints: endpoints.map((endpoint, i) => ({
            endpoint,
            healthy: results[i]
          }))
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
} 