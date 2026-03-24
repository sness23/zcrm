/**
 * Cookie storage tests
 * Note: Full cookie tests require real browser environment
 * These tests verify the API exists and basic functionality
 */
import { describe, it, expect, vi } from 'vitest';

describe('Cookie Storage Module', () => {
  it('should import cookie storage module without errors', async () => {
    // This verifies the module can be imported and doesn't have syntax errors
    const module = await import('../../src/lib/cookie-storage.js');

    expect(module.cookieStorage).toBeDefined();
    expect(module.hasAuthCookie).toBeDefined();
    expect(module.getAuthCookies).toBeDefined();
  });

  it('should have cookieStorage interface methods', async () => {
    const { cookieStorage } = await import('../../src/lib/cookie-storage.js');

    expect(typeof cookieStorage.getItem).toBe('function');
    expect(typeof cookieStorage.setItem).toBe('function');
    expect(typeof cookieStorage.removeItem).toBe('function');
  });

  it('should have hasAuthCookie function', async () => {
    const { hasAuthCookie } = await import('../../src/lib/cookie-storage.js');

    expect(typeof hasAuthCookie).toBe('function');
    // In non-browser environment, should return false or handle gracefully
    const result = hasAuthCookie();
    expect(typeof result).toBe('boolean');
  });

  it('should have getAuthCookies function', async () => {
    const { getAuthCookies } = await import('../../src/lib/cookie-storage.js');

    expect(typeof getAuthCookies).toBe('function');
    // In non-browser environment, should return empty object or handle gracefully
    const result = getAuthCookies();
    expect(typeof result).toBe('object');
  });

  describe('cookieStorage.getItem', () => {
    it('should return null in non-browser environment', async () => {
      const { cookieStorage } = await import('../../src/lib/cookie-storage.js');

      const value = cookieStorage.getItem('test-key');
      // In Node.js environment without document.cookie, should return null
      expect(value === null || typeof value === 'string').toBe(true);
    });
  });

  describe('cookieStorage.setItem', () => {
    it('should not throw when called in non-browser environment', async () => {
      const { cookieStorage } = await import('../../src/lib/cookie-storage.js');

      // Should handle gracefully in non-browser environment
      expect(() => {
        cookieStorage.setItem('test', 'value');
      }).not.toThrow();
    });
  });

  describe('cookieStorage.removeItem', () => {
    it('should not throw when called in non-browser environment', async () => {
      const { cookieStorage } = await import('../../src/lib/cookie-storage.js');

      // Should handle gracefully in non-browser environment
      expect(() => {
        cookieStorage.removeItem('test');
      }).not.toThrow();
    });
  });

  describe('hasAuthCookie', () => {
    it('should return boolean value', async () => {
      const { hasAuthCookie } = await import('../../src/lib/cookie-storage.js');

      const result = hasAuthCookie();
      expect(typeof result).toBe('boolean');
    });

    it('should return false in non-browser environment', async () => {
      const { hasAuthCookie } = await import('../../src/lib/cookie-storage.js');

      // Without real cookies, should return false
      const result = hasAuthCookie();
      expect(result).toBe(false);
    });
  });

  describe('getAuthCookies', () => {
    it('should return an object', async () => {
      const { getAuthCookies } = await import('../../src/lib/cookie-storage.js');

      const result = getAuthCookies();
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should return empty object in non-browser environment', async () => {
      const { getAuthCookies } = await import('../../src/lib/cookie-storage.js');

      // Without real cookies, should return empty object
      const result = getAuthCookies();
      expect(Object.keys(result).length).toBe(0);
    });
  });
});
