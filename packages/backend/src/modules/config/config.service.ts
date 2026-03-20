import { PrismaClient } from '@prisma/client';
import { redis } from '../../config/redis';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { CONFIG_CATEGORIES, type ConfigCategory, type AnyConfigValue, type TenantConfigEntry } from './config.types';
import { ethiopiaDefaults } from './defaults/ethiopia';
import { genericDefaults } from './defaults/generic';
import { configSchemaMap } from './config.validator';

type DbClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Cache TTL: 5 minutes
const CACHE_TTL = 300;

function cacheKey(tenantId: string, category: string): string {
  return `config:${tenantId}:${category}`;
}

function getDefaultsForCountry(country: string): Record<string, AnyConfigValue> {
  if (country === 'ET') {
    return ethiopiaDefaults as unknown as Record<string, AnyConfigValue>;
  }
  return genericDefaults as unknown as Record<string, AnyConfigValue>;
}

export class ConfigService {
  /**
   * Get all config categories for a tenant.
   * Returns an array of TenantConfigEntry (id, tenantId, category, config, updatedAt, updatedBy).
   */
  async getAllConfigs(
    tenantId: string,
    db: DbClient,
  ): Promise<TenantConfigEntry[]> {
    // Sequential query on RLS-scoped connection — no Promise.all
    const rows = await db.tenantConfig.findMany({
      where: { tenantId },
      orderBy: { category: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      category: row.category,
      config: row.config as unknown as AnyConfigValue,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    }));
  }

  /**
   * Get a single config category. Checks Redis cache first.
   * Throws NotFoundError if the category has never been initialized.
   */
  async getConfig(
    tenantId: string,
    category: ConfigCategory,
    db: DbClient,
  ): Promise<AnyConfigValue> {
    const key = cacheKey(tenantId, category);

    // Try cache first
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as AnyConfigValue;
    }

    const row = await db.tenantConfig.findUnique({
      where: { tenantId_category: { tenantId, category } },
    });

    if (!row) {
      throw new NotFoundError(
        `Config category '${category}' not found for this tenant. Run POST /v1/config/initialize first.`,
      );
    }

    const value = row.config as unknown as AnyConfigValue;

    // Populate cache
    await redis.setex(key, CACHE_TTL, JSON.stringify(value));

    return value;
  }

  /**
   * Update a single config category.
   * Validates the payload against the category's Zod schema, then persists and
   * invalidates the Redis cache entry.
   */
  async updateConfig(
    tenantId: string,
    category: ConfigCategory,
    config: AnyConfigValue,
    userId: string,
    db: DbClient,
  ): Promise<AnyConfigValue> {
    // Validate against the typed schema for this category
    const schema = configSchemaMap[category];
    const parseResult = schema.safeParse(config);
    if (!parseResult.success) {
      throw new BadRequestError(
        `Invalid config for category '${category}': ${parseResult.error.message}`,
      );
    }

    const upserted = await db.tenantConfig.upsert({
      where: { tenantId_category: { tenantId, category } },
      update: {
        config: parseResult.data as object,
        updatedBy: userId,
      },
      create: {
        tenantId,
        category,
        config: parseResult.data as object,
        updatedBy: userId,
      },
    });

    // Invalidate cache so next read fetches the fresh value
    await redis.del(cacheKey(tenantId, category));

    return upserted.config as unknown as AnyConfigValue;
  }

  /**
   * Initialize all default config categories for a new tenant.
   * Uses a for...of loop (never Promise.all) to keep all writes on the same
   * RLS-scoped connection.
   *
   * Existing categories are left unchanged (upsert with empty update).
   */
  async initializeDefaults(
    tenantId: string,
    country: string,
    userId: string,
    db: DbClient,
  ): Promise<Record<string, AnyConfigValue>> {
    const defaults = getDefaultsForCountry(country);
    const result: Record<string, AnyConfigValue> = {};

    for (const category of CONFIG_CATEGORIES) {
      const defaultValue = defaults[category];
      if (defaultValue === undefined) {
        continue;
      }

      const row = await db.tenantConfig.upsert({
        where: { tenantId_category: { tenantId, category } },
        // Do not overwrite if the category already has a value
        update: {},
        create: {
          tenantId,
          category,
          config: defaultValue as object,
          updatedBy: userId,
        },
      });

      // Invalidate any stale cache entry for this category
      await redis.del(cacheKey(tenantId, category));

      result[category] = row.config as unknown as AnyConfigValue;
    }

    return result;
  }
}

export const configService = new ConfigService();
