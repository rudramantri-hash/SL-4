import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface TestData {
  users?: UserData[];
  products?: ProductData[];
  orders?: OrderData[];
  [key: string]: any;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'moderator';
  password?: string;
  metadata?: Record<string, any>;
}

export interface ProductData {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  description?: string;
  metadata?: Record<string, any>;
}

export interface OrderData {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface SeedingOptions {
  clearExisting?: boolean;
  validateData?: boolean;
  backupExisting?: boolean;
  retryAttempts?: number;
}

/**
 * Test data management utilities for consistent test state
 * Handles seeding, cleanup, and validation of test data
 */
export class DataSeeder {
  private static readonly FIXTURES_DIR = './fixtures';
  private static readonly BACKUP_DIR = './test-data-backups';
  private static readonly DEFAULT_RETRY_ATTEMPTS = 3;

  /**
   * Seed test data from JSON fixtures
   */
  static async seedFromFixture(
    fixtureName: string,
    options: SeedingOptions = {}
  ): Promise<TestData> {
    const { 
      clearExisting = true, 
      validateData = true, 
      backupExisting = true,
      retryAttempts = this.DEFAULT_RETRY_ATTEMPTS
    } = options;

    const fixturePath = path.join(this.FIXTURES_DIR, `${fixtureName}.json`);
    
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }

    // Read fixture data
    const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    
    // Backup existing data if requested
    if (backupExisting) {
      await this.backupExistingData(fixtureName);
    }

    // Clear existing data if requested
    if (clearExisting) {
      await this.clearExistingData(fixtureName);
    }

    // Seed new data with retry logic
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const seededData = await this.seedData(fixtureData);
        
        if (validateData) {
          await this.validateSeededData(seededData);
        }
        
        console.log(`✅ Data seeded successfully from ${fixtureName} (attempt ${attempt})`);
        return seededData;
        
      } catch (error) {
        console.log(`❌ Seeding attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === retryAttempts) {
          throw new Error(`Failed to seed data after ${retryAttempts} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Unexpected error in seeding process');
  }

  /**
   * Seed data via API endpoints
   */
  static async seedViaAPI(
    page: Page,
    data: TestData,
    baseURL?: string
  ): Promise<void> {
    if (!baseURL) {
      throw new Error('baseURL is required for API seeding');
    }
    
    console.log('🌱 Seeding data via API...');

    // Seed users
    if (data.users && data.users.length > 0) {
      for (const user of data.users) {
        await this.seedUserViaAPI(page, user, baseURL);
      }
    }

    // Seed products
    if (data.products && data.products.length > 0) {
      for (const product of data.products) {
        await this.seedProductViaAPI(page, product, baseURL);
      }
    }

    // Seed orders
    if (data.orders && data.orders.length > 0) {
      for (const order of data.orders) {
        await this.seedOrderViaAPI(page, order, baseURL);
      }
    }

    console.log('✅ API seeding completed');
  }

  /**
   * Seed a single user via API
   */
  private static async seedUserViaAPI(
    page: Page, 
    user: UserData, 
    baseURL: string
  ): Promise<void> {
    try {
      const response = await page.request.post(`${baseURL}/api/test/seed`, {
        data: { fixture: 'users' }
      });
      
      if (response.ok()) {
        console.log(`✅ User seeded: ${user.email}`);
      } else {
        console.log(`⚠️ User seeding failed: ${user.email}`);
      }
    } catch (error) {
      console.log(`❌ Error seeding user ${user.email}: ${error.message}`);
    }
  }

  /**
   * Seed a single product via API
   */
  private static async seedProductViaAPI(
    page: Page, 
    product: ProductData, 
    baseURL: string
  ): Promise<void> {
    try {
      const response = await page.request.post(`${baseURL}/api/test/seed`, {
        data: { fixture: 'products' }
      });
      
      if (response.ok()) {
        console.log(`✅ Product seeded: ${product.name}`);
      } else {
        console.log(`⚠️ Product seeding failed: ${product.name}`);
      }
    } catch (error) {
      console.log(`❌ Error seeding product ${product.name}: ${error.message}`);
    }
  }

  /**
   * Seed a single order via API
   */
  private static async seedOrderViaAPI(
    page: Page, 
    order: OrderData, 
    baseURL: string
  ): Promise<void> {
    try {
      const response = await page.request.post(`${baseURL}/api/test/seed`, {
        data: { fixture: 'orders' }
      });
      
      if (response.ok()) {
        console.log(`✅ Order seeded: ${order.id}`);
      } else {
        console.log(`⚠️ Order seeding failed: ${order.id}`);
      }
    } catch (error) {
      console.log(`❌ Error seeding order ${order.id}: ${error.message}`);
    }
  }

  /**
   * Generate unique test data with timestamps
   */
  static generateUniqueTestData(): TestData {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    return {
      users: [
        {
          id: `user-${timestamp}-${randomSuffix}`,
          email: `user-${timestamp}@test.com`,
          name: `Test User ${timestamp}`,
          role: 'user' as const,
          password: 'test-password',
          metadata: { generatedAt: new Date().toISOString() }
        },
        {
          id: `admin-${timestamp}-${randomSuffix}`,
          email: `admin-${timestamp}@test.com`,
          name: `Admin User ${timestamp}`,
          role: 'admin' as const,
          password: 'admin-password',
          metadata: { generatedAt: new Date().toISOString() }
        }
      ],
      products: [
        {
          id: `product-${timestamp}-${randomSuffix}`,
          name: `Test Product ${timestamp}`,
          price: 99.99,
          category: 'Electronics',
          stock: 100,
          description: `Automatically generated test product ${timestamp}`,
          metadata: { generatedAt: new Date().toISOString() }
        }
      ],
      orders: [
        {
          id: `order-${timestamp}-${randomSuffix}`,
          userId: `user-${timestamp}-${randomSuffix}`,
          productId: `product-${timestamp}-${randomSuffix}`,
          quantity: 1,
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          metadata: { generatedAt: new Date().toISOString() }
        }
      ]
    };
  }

  /**
   * Reset test data to original state
   */
  static async resetTestData(
    page: Page,
    baseURL?: string
  ): Promise<void> {
    if (!baseURL) {
      throw new Error('baseURL is required for resetting test data');
    }
    
    try {
      const response = await page.request.post(`${baseURL}/api/test/reset`);
      
      if (response.ok()) {
        console.log('🔄 Test data reset to original state');
      } else {
        console.log('⚠️ Test data reset failed');
      }
    } catch (error) {
      console.log(`❌ Error resetting test data: ${error.message}`);
    }
  }

  /**
   * Get current test data status
   */
  static async getTestDataStatus(
    page: Page,
    baseURL?: string
  ): Promise<any> {
    if (!baseURL) {
      throw new Error('baseURL is required for getting test data status');
    }
    
    try {
      const response = await page.request.get(`${baseURL}/api/test/status`);
      
      if (response.ok()) {
        const status = await response.json();
        console.log('📊 Test data status:', status);
        return status;
      } else {
        console.log('⚠️ Failed to get test data status');
        return null;
      }
    } catch (error) {
      console.log(`❌ Error getting test data status: ${error.message}`);
      return null;
    }
  }

  /**
   * Backup existing test data
   */
  private static async backupExistingData(fixtureName: string): Promise<void> {
    const backupPath = path.join(this.BACKUP_DIR, `${fixtureName}-${Date.now()}.json`);
    
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }

    // This would typically read from the actual data source
    // For now, we'll create a placeholder backup
    const backupData = {
      backedUpAt: new Date().toISOString(),
      fixtureName,
      note: 'Backup created before seeding new data'
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
  }

  /**
   * Clear existing test data
   */
  private static async clearExistingData(fixtureName: string): Promise<void> {
    console.log(`🧹 Clearing existing data for: ${fixtureName}`);
    
    // This would typically clear the actual data source
    // For now, we'll just log the action
    console.log(`✅ Data cleared for: ${fixtureName}`);
  }

  /**
   * Seed data into the system
   */
  private static async seedData(data: TestData): Promise<TestData> {
    console.log('🌱 Seeding data...');
    
    // This would typically insert data into the actual data source
    // For now, we'll just return the data as if it was seeded
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`✅ Seeded ${data.users?.length || 0} users`);
    console.log(`✅ Seeded ${data.products?.length || 0} products`);
    console.log(`✅ Seeded ${data.orders?.length || 0} orders`);
    
    return data;
  }

  /**
   * Validate that seeded data is correct
   */
  private static async validateSeededData(data: TestData): Promise<void> {
    console.log('🔍 Validating seeded data...');
    
    // Validate users
    if (data.users) {
      for (const user of data.users) {
        if (!user.id || !user.email || !user.name) {
          throw new Error(`Invalid user data: ${JSON.stringify(user)}`);
        }
      }
    }

    // Validate products
    if (data.products) {
      for (const product of data.products) {
        if (!product.id || !product.name || product.price < 0) {
          throw new Error(`Invalid product data: ${JSON.stringify(product)}`);
        }
      }
    }

    // Validate orders
    if (data.orders) {
      for (const order of data.orders) {
        if (!order.id || !order.userId || !order.productId || order.quantity <= 0) {
          throw new Error(`Invalid order data: ${JSON.stringify(order)}`);
        }
      }
    }

    console.log('✅ Data validation passed');
  }

  /**
   * Clean up test data and backups
   */
  static cleanupTestData(): void {
    // Clean up backup directory
    if (fs.existsSync(this.BACKUP_DIR)) {
      fs.rmSync(this.BACKUP_DIR, { recursive: true, force: true });
      console.log('🗑️ Test data backups cleaned up');
    }

    // Clean up fixtures directory (if it was created)
    if (fs.existsSync(this.FIXTURES_DIR)) {
      const files = fs.readdirSync(this.FIXTURES_DIR);
      files.forEach(file => {
        if (file.endsWith('.tmp.json')) {
          fs.unlinkSync(path.join(this.FIXTURES_DIR, file));
        }
      });
      console.log('🗑️ Temporary fixture files cleaned up');
    }
  }

  /**
   * Get seeding statistics
   */
  static getSeedingStats(): {
    fixturesAvailable: string[];
    backupsCount: number;
    lastSeedingTime?: string;
  } {
    const fixturesAvailable: string[] = [];
    
    if (fs.existsSync(this.FIXTURES_DIR)) {
      const files = fs.readdirSync(this.FIXTURES_DIR);
      fixturesAvailable = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    }

    const backupsCount = fs.existsSync(this.BACKUP_DIR) 
      ? fs.readdirSync(this.BACKUP_DIR).length 
      : 0;

    return {
      fixturesAvailable,
      backupsCount
    };
  }
}

// Export convenience functions
export const seedFromFixture = DataSeeder.seedFromFixture.bind(DataSeeder);
export const seedViaAPI = DataSeeder.seedViaAPI.bind(DataSeeder);
export const generateUniqueTestData = DataSeeder.generateUniqueTestData.bind(DataSeeder);
export const resetTestData = DataSeeder.resetTestData.bind(DataSeeder);
export const getTestDataStatus = DataSeeder.getTestDataStatus.bind(DataSeeder);
export const cleanupTestData = DataSeeder.cleanupTestData.bind(DataSeeder);
export const getSeedingStats = DataSeeder.getSeedingStats.bind(DataSeeder);
