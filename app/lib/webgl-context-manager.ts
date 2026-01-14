/**
 * WebGL Context Manager
 * 
 * Manages WebGL contexts to prevent browser limits from being exceeded.
 * Browsers typically limit WebGL contexts to 16 per page.
 * This manager tracks active contexts and forces cleanup when needed.
 */

interface ContextOwner {
  id: string;
  priority: number; // Higher priority = kept longer
  cleanup: () => void;
  createdAt: number;
}

class WebGLContextManager {
  private activeContexts: Map<string, ContextOwner> = new Map();
  private readonly MAX_CONTEXTS = 12; // Leave headroom (browser limit is typically 16)
  
  /**
   * Register a new WebGL context owner
   */
  register(id: string, cleanup: () => void, priority: number = 0): void {
    // If we're at the limit, remove lowest priority context
    if (this.activeContexts.size >= this.MAX_CONTEXTS) {
      this.removeLowestPriority();
    }
    
    this.activeContexts.set(id, {
      id,
      priority,
      cleanup,
      createdAt: Date.now(),
    });
    
    console.log(`[WebGL Manager] Registered context: ${id} (total: ${this.activeContexts.size}/${this.MAX_CONTEXTS})`);
  }
  
  /**
   * Unregister a WebGL context owner
   */
  unregister(id: string): void {
    const owner = this.activeContexts.get(id);
    if (owner) {
      owner.cleanup();
      this.activeContexts.delete(id);
      console.log(`[WebGL Manager] Unregistered context: ${id} (total: ${this.activeContexts.size}/${this.MAX_CONTEXTS})`);
    }
  }
  
  /**
   * Update priority of an existing context
   */
  updatePriority(id: string, priority: number): void {
    const owner = this.activeContexts.get(id);
    if (owner) {
      owner.priority = priority;
    }
  }
  
  /**
   * Remove the lowest priority context
   */
  private removeLowestPriority(): void {
    if (this.activeContexts.size === 0) return;
    
    let lowestPriority = Infinity;
    let oldestTime = Infinity;
    let targetId: string | null = null;
    
    // Find lowest priority, and if tied, oldest context
    for (const [id, owner] of this.activeContexts) {
      if (owner.priority < lowestPriority || 
          (owner.priority === lowestPriority && owner.createdAt < oldestTime)) {
        lowestPriority = owner.priority;
        oldestTime = owner.createdAt;
        targetId = id;
      }
    }
    
    if (targetId) {
      console.warn(`[WebGL Manager] Removing lowest priority context: ${targetId} (priority: ${lowestPriority})`);
      this.unregister(targetId);
    }
  }
  
  /**
   * Force cleanup of all contexts
   */
  cleanup(): void {
    console.log(`[WebGL Manager] Cleaning up all ${this.activeContexts.size} contexts`);
    for (const [id, owner] of this.activeContexts) {
      owner.cleanup();
    }
    this.activeContexts.clear();
  }
  
  /**
   * Get current context count
   */
  getContextCount(): number {
    return this.activeContexts.size;
  }
  
  /**
   * Check if we're near the limit
   */
  isNearLimit(): boolean {
    return this.activeContexts.size >= this.MAX_CONTEXTS - 2;
  }
}

// Global singleton instance
export const webglContextManager = new WebGLContextManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    webglContextManager.cleanup();
  });
}

