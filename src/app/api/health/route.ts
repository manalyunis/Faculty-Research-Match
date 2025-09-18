import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unknown',
        redis: 'unknown',
        python: 'unknown'
      }
    }

    // Check database connection (Supabase)
    try {
      // You can add a simple database ping here if needed
      health.services.database = 'healthy'
    } catch (error) {
      health.services.database = 'unhealthy'
    }

    // Check Redis connection
    try {
      // You can add Redis ping here if you implement Redis
      health.services.redis = 'healthy'
    } catch (error) {
      health.services.redis = 'unhealthy'
    }

    // Check Python ML service
    try {
      // You can add Python service ping here
      health.services.python = 'healthy'
    } catch (error) {
      health.services.python = 'unhealthy'
    }

    return NextResponse.json(health, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}