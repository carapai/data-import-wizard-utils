export class ObjectSet<T> implements Iterable<T> {
    private items: Map<string, T> = new Map<string, T>();
    private keyFn: (item: T) => string;

    /**
     * Creates a new ObjectSet.
     * @param keyFn A function that returns a unique string key for each item.
     *              This key is used to determine object equality.
     * @param initialItems Optional array of initial items to add to the set.
     */
    constructor(keyFn: (item: T) => string, initialItems: T[] = []) {
        this.keyFn = keyFn;

        for (const item of initialItems) {
            this.add(item);
        }
    }

    /**
     * Adds an item to the set.
     * If an item with the same key already exists, it will be replaced.
     * @param item The item to add.
     * @returns The ObjectSet instance for chaining.
     */
    add(item: T): ObjectSet<T> {
        const key = this.keyFn(item);
        this.items.set(key, item);
        return this;
    }

    /**
     * Checks if an item exists in the set.
     * @param item The item to check.
     * @returns True if the item exists in the set, false otherwise.
     */
    has(item: T): boolean {
        const key = this.keyFn(item);
        return this.items.has(key);
    }

    /**
     * Removes an item from the set.
     * @param item The item to remove.
     * @returns True if the item was removed, false if it didn't exist.
     */
    delete(item: T): boolean {
        const key = this.keyFn(item);
        return this.items.delete(key);
    }

    /**
     * Gets an item from the set based on a partial item that would generate the same key.
     * @param partialItem An object that generates the same key as the item to get.
     * @returns The item if found, undefined otherwise.
     */
    get(partialItem: T): T | undefined {
        const key = this.keyFn(partialItem);
        return this.items.get(key);
    }

    /**
     * Clears all items from the set.
     */
    clear(): void {
        this.items.clear();
    }

    /**
     * Gets the number of items in the set.
     */
    get size(): number {
        return this.items.size;
    }

    /**
     * Returns an iterator over the items in the set.
     */
    [Symbol.iterator](): Iterator<T> {
        return this.items.values();
    }

    /**
     * Returns an array containing all items in the set.
     */
    toArray(): T[] {
        return Array.from(this.items.values());
    }

    /**
     * Returns the union of this set with another ObjectSet.
     * @param other The other set to union with.
     * @returns A new ObjectSet containing all items from both sets.
     */
    union(other: ObjectSet<T>): ObjectSet<T> {
        const result = new ObjectSet<T>(this.keyFn);

        // Add all items from this set
        for (const item of this) {
            result.add(item);
        }

        // Add all items from the other set
        for (const item of other) {
            result.add(item);
        }

        return result;
    }

    /**
     * Returns the intersection of this set with another ObjectSet.
     * @param other The other set to intersect with.
     * @returns A new ObjectSet containing only items that exist in both sets.
     */
    intersection(other: ObjectSet<T>): ObjectSet<T> {
        const result = new ObjectSet<T>(this.keyFn);

        for (const item of this) {
            if (other.has(item)) {
                result.add(item);
            }
        }

        return result;
    }

    /**
     * Returns the difference of this set with another ObjectSet.
     * @param other The other set to subtract.
     * @returns A new ObjectSet containing items that exist in this set but not in the other set.
     */
    difference(other: ObjectSet<T>): ObjectSet<T> {
        const result = new ObjectSet<T>(this.keyFn);

        for (const item of this) {
            if (!other.has(item)) {
                result.add(item);
            }
        }

        return result;
    }
}
