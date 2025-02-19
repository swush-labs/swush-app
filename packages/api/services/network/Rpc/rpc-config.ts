import { RPC_ENDPOINTS } from 'services/constants';
import { HEALTH_CHECK } from 'services/constants';
import { z } from 'zod';


export const RpcEndpointSchema = z.object({
  url: z.string().url(),
  priority: z.number().int().min(1),
  isActive: z.boolean().default(true),
  lastError: z.string().optional(),
  lastChecked: z.date().optional(),
});

export const NetworkConfigSchema = z.object({
  endpoints: z.array(RpcEndpointSchema),
  currentIndex: z.number().int().min(0).default(0),
  healthCheck: z.object({
    interval: z.number().int().min(1000).default(HEALTH_CHECK.INTERVAL),
    timeout: z.number().int().min(1000).default(HEALTH_CHECK.TIMEOUT),
  }).default({
    interval: HEALTH_CHECK.INTERVAL,
    timeout: HEALTH_CHECK.TIMEOUT,
  }),
});

export type RpcEndpoint = z.infer<typeof RpcEndpointSchema>;
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

// Default configuration for different networks
export const DEFAULT_RPC_CONFIG: Record<string, NetworkConfig> = RPC_ENDPOINTS;