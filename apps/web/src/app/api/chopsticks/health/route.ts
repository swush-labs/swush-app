import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const endpoints = [
      'ws://localhost:3421', // Asset Hub
      'ws://localhost:3422'  // Hydration
    ];

    // Test WebSocket connections
    const healthChecks = endpoints.map(endpoint => 
      new Promise((resolve) => {
        const ws = new WebSocket(endpoint);
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 2000);

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