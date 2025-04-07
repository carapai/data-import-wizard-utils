/**
 * Type definition for a nested Map (2 levels deep)
 */
type NestedMap<K1, K2, V> = Map<K1, Map<K2, V>>;

/**
 * Interface for the result of a diff join operation
 */
interface MapDiffResult<K, V1, V2> {
    added: Map<K, V2>; // keys in map2 that aren't in map1
    removed: Map<K, V1>; // keys in map1 that aren't in map2
    modified: Map<K, { from: V1; to: V2 }>; // keys in both maps but with different values
    same: Map<K, V1>; // keys in both maps with same values
}

/**
 * Type definition for maps of arbitrary nesting depth
 */
type DeepMap<K extends any[], V> = K extends [infer K1]
    ? Map<K1, V>
    : K extends [infer K1, ...infer KRest]
    ? Map<K1, DeepMap<KRest, V>>
    : never;

/**
 * Creates a new nested Map with two levels
 */
function createNestedMap<K1, K2, V>(): NestedMap<K1, K2, V> {
    return new Map<K1, Map<K2, V>>();
}

/**
 * Sets a value in a nested Map, creating intermediate Maps as needed
 *
 * @param nestedMap The nested map to update
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @param value The value to set
 * @returns The updated nested map (for chaining)
 */
function setNested<K1, K2, V>(
    nestedMap: NestedMap<K1, K2, V>,
    key1: K1,
    key2: K2,
    value: V,
): NestedMap<K1, K2, V> {
    if (!nestedMap.has(key1)) {
        nestedMap.set(key1, new Map<K2, V>());
    }

    const innerMap = nestedMap.get(key1)!;
    innerMap.set(key2, value);

    return nestedMap;
}

/**
 * Gets a value from a nested Map
 *
 * @param nestedMap The nested map to query
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @returns The value or undefined if not found
 */
function getNested<K1, K2, V>(
    nestedMap: NestedMap<K1, K2, V>,
    key1: K1,
    key2: K2,
): V | undefined {
    const innerMap = nestedMap.get(key1);
    if (!innerMap) return undefined;
    return innerMap.get(key2);
}

/**
 * Deletes a value from a nested Map
 *
 * @param nestedMap The nested map to update
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @returns true if the element was removed, false otherwise
 */
function deleteNested<K1, K2, V>(
    nestedMap: NestedMap<K1, K2, V>,
    key1: K1,
    key2: K2,
) {
    const innerMap = nestedMap.get(key1);
    if (!innerMap) return nestedMap;
    innerMap.delete(key2);
    nestedMap.set(key1, innerMap);
    return nestedMap;
}

/**
 * Updates a value in a nested Map using an update function
 *
 * @param nestedMap The nested map to update
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @param updateFn Function that receives current value (or defaultValue) and returns new value
 * @param defaultValue Default value to use if the key doesn't exist
 * @returns The updated nested map (for chaining)
 */
function updateNested<K1, K2, V>(
    nestedMap: NestedMap<K1, K2, V>,
    key1: K1,
    key2: K2,
    updateFn: (currentValue: V | undefined) => V,
    defaultValue?: V,
): NestedMap<K1, K2, V> {
    const currentValue = getNested(nestedMap, key1, key2);
    const newValue = updateFn(
        currentValue !== undefined ? currentValue : defaultValue,
    );
    return setNested(nestedMap, key1, key2, newValue);
}

/**
 * Converts a nested Map to a flat array of entries
 *
 * @param nestedMap The nested map to flatten
 * @returns An array of [key1, key2, value] tuples
 */
function flattenEntries<K1, K2, V>(
    nestedMap: NestedMap<K1, K2, V>,
): [K1, K2, V][] {
    const result: [K1, K2, V][] = [];

    for (const [key1, innerMap] of nestedMap) {
        for (const [key2, value] of innerMap) {
            result.push([key1, key2, value]);
        }
    }
    return result;
}

/**
 * Creates a nested Map from a flat array of entries
 *
 * @param entries An array of [key1, key2, value] tuples
 * @returns A new nested map constructed from the entries
 */
function fromFlatEntries<K1, K2, V>(
    entries: [K1, K2, V][],
): NestedMap<K1, K2, V> {
    const result = createNestedMap<K1, K2, V>();

    for (const [key1, key2, value] of entries) {
        setNested(result, key1, key2, value);
    }

    return result;
}

/**
 * Merges two nested Maps with a custom merge function for values
 *
 * @param target The target nested map that will be modified
 * @param source The source nested map to merge from
 * @param mergeFn Function that determines how to merge values (defaults to taking the source value)
 * @returns The updated target map
 */
function mergeNestedMaps<K1, K2, V>(
    target: NestedMap<K1, K2, V>,
    source: NestedMap<K1, K2, V>,
    mergeFn: (targetValue: V | undefined, sourceValue: V) => V = (
        targetValue,
        sourceValue,
    ) => sourceValue,
): NestedMap<K1, K2, V> {
    for (const [key1, sourceInnerMap] of source) {
        let targetInnerMap = target.get(key1);

        if (!targetInnerMap) {
            targetInnerMap = new Map<K2, V>();
            target.set(key1, targetInnerMap);
        }

        for (const [key2, sourceValue] of sourceInnerMap) {
            const targetValue = targetInnerMap.get(key2);
            targetInnerMap.set(key2, mergeFn(targetValue, sourceValue));
        }
    }

    return target;
}

/**
 * Transforms a nested Map by applying a function to each value
 *
 * @param nestedMap The nested map to transform
 * @param transformFn Function to apply to each value
 * @returns A new nested map with transformed values
 */
function mapValues<K1, K2, V, R>(
    nestedMap: NestedMap<K1, K2, V>,
    transformFn: (value: V, key2: K2, key1: K1) => R,
): NestedMap<K1, K2, R> {
    const result = createNestedMap<K1, K2, R>();

    for (const [key1, innerMap] of nestedMap) {
        const newInnerMap = new Map<K2, R>();
        result.set(key1, newInnerMap);

        for (const [key2, value] of innerMap) {
            newInnerMap.set(key2, transformFn(value, key2, key1));
        }
    }

    return result;
}

/**
 * Filters a nested Map based on a predicate function
 *
 * @param nestedMap The nested map to filter
 * @param predicateFn Function that determines whether to keep an entry
 * @returns A new filtered nested map
 */
function filterNested<K1, K2, V>(
    nestedMap: NestedMap<K1, K2, V>,
    predicateFn: (value: V, key2: K2, key1: K1) => boolean,
): NestedMap<K1, K2, V> {
    const result = createNestedMap<K1, K2, V>();

    for (const [key1, innerMap] of nestedMap) {
        for (const [key2, value] of innerMap) {
            if (predicateFn(value, key2, key1)) {
                setNested(result, key1, key2, value);
            }
        }
    }

    return result;
}

/**
 * Simple union: combines two maps with the second map's values
 * taking precedence for duplicate keys
 *
 * @param map1 First map
 * @param map2 Second map (values override map1 for duplicate keys)
 * @returns A new Map containing the union
 */
function mapUnion<K, V>(map1: Map<K, V>, map2: Map<K, V>): Map<K, V> {
    const result = new Map(map1);

    for (const [key, value] of map2) {
        result.set(key, value);
    }

    return result;
}

/**
 * Join with custom handler for key collisions
 *
 * @param map1 First map
 * @param map2 Second map
 * @param collisionHandler Function to handle key collisions (key, value1, value2) => resolvedValue
 * @returns A new Map with the join result
 */
function mapJoinWithHandler<K, V1, V2, R>(
    map1: Map<K, V1>,
    map2: Map<K, V2>,
    collisionHandler: (key: K, value1: V1, value2: V2) => R,
): Map<K, V1 | V2 | R> {
    const result = new Map<K, V1 | V2 | R>();

    // Add all entries from map1
    for (const [key, value] of map1) {
        result.set(key, value);
    }

    // Add or merge entries from map2
    for (const [key, value2] of map2) {
        if (result.has(key)) {
            const value1 = result.get(key) as V1;
            result.set(key, collisionHandler(key, value1, value2));
        } else {
            result.set(key, value2);
        }
    }

    return result;
}

/**
 * Intersection: creates a map with only the keys that exist in both maps
 *
 * @param map1 First map
 * @param map2 Second map
 * @param valueSelector Function to determine which value to keep (key, value1, value2) => resolvedValue
 * @returns A new Map containing only shared keys
 */
function mapIntersection<K, V1, V2, R>(
    map1: Map<K, V1>,
    map2: Map<K, V2>,
    valueSelector: (key: K, value1: V1, value2: V2) => R = (
        key,
        value1,
        value2,
    ) => value2 as unknown as R,
): Map<K, R> {
    const result = new Map<K, R>();

    for (const [key, value1] of map1) {
        if (map2.has(key)) {
            const value2 = map2.get(key) as V2;
            result.set(key, valueSelector(key, value1, value2));
        }
    }

    return result;
}

/**
 * Zip join: combines maps with composite values
 * Creates tuple values for each key present in either map
 *
 * @param map1 First map
 * @param map2 Second map
 * @returns A new Map with key → [value1, value2] (undefined if key missing in a map)
 */
function mapZipJoin<K, V1, V2>(
    map1: Map<K, V1>,
    map2: Map<K, V2>,
): Map<K, [V1 | undefined, V2 | undefined]> {
    const result = new Map<K, [V1 | undefined, V2 | undefined]>();

    // Add all keys from map1
    for (const [key, value] of map1) {
        result.set(key, [
            value,
            map2.has(key) ? (map2.get(key) as V2) : undefined,
        ]);
    }

    // Add remaining keys from map2
    for (const [key, value] of map2) {
        if (!map1.has(key)) {
            result.set(key, [undefined, value]);
        }
    }

    return result;
}

/**
 * Left join: like SQL LEFT JOIN, keeps all keys from map1
 *
 * @param map1 First map (left table)
 * @param map2 Second map (right table)
 * @param joinHandler Function to handle join (key, leftValue, rightValue) => result
 * @returns A new Map with the left join result
 */
function mapLeftJoin<K, V1, V2, R>(
    map1: Map<K, V1>,
    map2: Map<K, V2>,
    joinHandler: (key: K, value1: V1, value2: V2 | undefined) => R = (
        key,
        value1,
        value2,
    ) => [value1, value2] as unknown as R,
): Map<K, R> {
    const result = new Map<K, R>();

    for (const [key, value1] of map1) {
        const value2 = map2.has(key) ? (map2.get(key) as V2) : undefined;
        result.set(key, joinHandler(key, value1, value2));
    }

    return result;
}

/**
 * Diff join: identifies differences between two maps
 *
 * @param map1 First map
 * @param map2 Second map
 * @param equalityFn Optional function to determine if two values are equal
 * @returns Object with added, removed, and modified entries
 */
function mapDiffJoin<K, V1, V2>(
    map1: Map<K, V1>,
    map2: Map<K, V2>,
    equalityFn: (value1: V1, value2: V2) => boolean = (value1, value2) =>
        value1 === (value2 as any),
): MapDiffResult<K, V1, V2> {
    const result: MapDiffResult<K, V1, V2> = {
        added: new Map<K, V2>(),
        removed: new Map<K, V1>(),
        modified: new Map<K, { from: V1; to: V2 }>(),
        same: new Map<K, V1>(),
    };

    // Find removed and modified
    for (const [key, value1] of map1) {
        if (!map2.has(key)) {
            result.removed.set(key, value1);
        } else {
            const value2 = map2.get(key) as V2;
            if (!equalityFn(value1, value2)) {
                result.modified.set(key, { from: value1, to: value2 });
            } else {
                result.same.set(key, value1);
            }
        }
    }

    // Find added
    for (const [key, value2] of map2) {
        if (!map1.has(key)) {
            result.added.set(key, value2);
        }
    }

    return result;
}

/**
 * One-liner map join using ES6 spread syntax
 * Note: This is concise but less efficient for large maps
 *
 * @param map1 First map
 * @param map2 Second map (values override map1 for duplicate keys)
 * @returns A new Map with the joined result
 */
function mapJoinOneLiner<K, V>(map1: Map<K, V>, map2: Map<K, V>): Map<K, V> {
    return new Map([...map1, ...map2]);
}

// ===== OBJECT OPERATIONS =====

/**
 * Updates a field in an object value stored in a nested map
 *
 * @param nestedMap The nested map containing object values
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @param field The object field to update
 * @param newValue The new value for the field
 * @returns The updated nested map (for chaining)
 */
function updateObjectField<K1, K2, T extends object, F extends keyof T>(
    nestedMap: NestedMap<K1, K2, T>,
    key1: K1,
    key2: K2,
    field: F,
    newValue: T[F],
): NestedMap<K1, K2, T> {
    return updateNested(nestedMap, key1, key2, (current) => {
        if (!current) {
            // Create a new object with the field if it doesn't exist
            return { [field]: newValue } as unknown as T;
        }

        // Create a new object with the updated field
        return {
            ...current,
            [field]: newValue,
        };
    });
}

/**
 * Deletes a field from an object value stored in a nested map
 *
 * @param nestedMap The nested map containing object values
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @param field The object field to delete
 * @returns The updated nested map (for chaining)
 */
function deleteObjectField<K1, K2, T extends object, F extends keyof T>(
    nestedMap: NestedMap<K1, K2, T>,
    key1: K1,
    key2: K2,
    field: F,
): NestedMap<K1, K2, T> {
    return updateNested(nestedMap, key1, key2, (current) => {
        if (!current) {
            return {} as T;
        }
        const { [field]: omitted, ...rest } = current;
        return rest as T;
    });
}

/**
 * Patches multiple fields in an object value stored in a nested map
 *
 * @param nestedMap The nested map containing object values
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @param patch The partial object with fields to update
 * @returns The updated nested map (for chaining)
 */
function patchObject<K1, K2, T extends object>(
    nestedMap: NestedMap<K1, K2, T>,
    key1: K1,
    key2: K2,
    patch: Partial<T>,
): NestedMap<K1, K2, T> {
    return updateNested(nestedMap, key1, key2, (current) => {
        if (!current) {
            return patch as T;
        }

        return { ...current, ...patch };
    });
}

/**
 * A generic function for updating deeply nested fields within an object
 * Uses a path array to specify the location of the field to update
 *
 * @param obj The original object
 * @param path Array of keys/indices representing the path to the field
 * @param value The new value to set
 * @returns A new object with the updated field
 */
function updateDeepField<T extends object, V>(
    obj: T,
    path: (string | number)[],
    value: V,
): T {
    if (path.length === 0) return obj;

    const [head, ...rest] = path;

    if (rest.length === 0) {
        // Base case: set the value at the final path segment
        return {
            ...obj,
            [head]: value,
        };
    }

    // Handle arrays and objects differently
    const currentValue = obj[head as keyof T];

    // We need to ensure the path exists as we traverse
    const nextValue =
        currentValue !== undefined && typeof currentValue === "object"
            ? currentValue
            : typeof rest[0] === "number"
            ? []
            : {};

    // Recursively update the rest of the path
    return {
        ...obj,
        [head]: updateDeepField(nextValue as object, rest, value),
    };
}

/**
 * Deletes a deeply nested field within an object
 *
 * @param obj The original object
 * @param path Array of keys/indices representing the path to the field
 * @returns A new object with the field removed
 */
function deleteDeepField<T extends object>(
    obj: T,
    path: (string | number)[],
): T {
    if (path.length === 0) return obj;

    const [head, ...rest] = path;

    if (rest.length === 0) {
        // Base case: remove the field
        const { [head as keyof T]: _, ...remaining } = obj;
        return remaining as T;
    }

    // Skip if the path doesn't exist
    if (!(head in obj)) return obj;

    const currentValue = obj[head as keyof T];
    if (typeof currentValue !== "object" || currentValue === null) return obj;

    // Recursively delete in the nested object
    return {
        ...obj,
        [head]: deleteDeepField(currentValue as object, rest),
    };
}

/**
 * Updates a deeply nested field within an object stored in a nested map
 *
 * @param nestedMap The nested map
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @param fieldPath Path to the field to update
 * @param value The new value
 * @returns The updated nested map
 */
function updateNestedObjectField<K1, K2, T extends object, V>(
    nestedMap: NestedMap<K1, K2, T>,
    key1: K1,
    key2: K2,
    fieldPath: (string | number)[],
    value: V,
): NestedMap<K1, K2, T> {
    return updateNested(nestedMap, key1, key2, (current) => {
        if (!current) {
            // Create a new object with the deep field
            let result = {} as any;
            let pointer = result;
            const lastIndex = fieldPath.length - 1;

            for (let i = 0; i < lastIndex; i++) {
                pointer[fieldPath[i]] =
                    typeof fieldPath[i + 1] === "number" ? [] : {};
                pointer = pointer[fieldPath[i]];
            }

            pointer[fieldPath[lastIndex]] = value;
            return result as T;
        }

        return updateDeepField(current, fieldPath, value);
    });
}

/**
 * Deletes a deeply nested field from an object stored in a nested map
 *
 * @param nestedMap The nested map
 * @param key1 The first-level key
 * @param key2 The second-level key
 * @param fieldPath Path to the field to delete
 * @returns The updated nested map
 */
function deleteNestedObjectField<K1, K2, T extends object>(
    nestedMap: NestedMap<K1, K2, T>,
    key1: K1,
    key2: K2,
    fieldPath: (string | number)[],
): NestedMap<K1, K2, T> {
    return updateNested(nestedMap, key1, key2, (current) => {
        if (!current) return {} as T;
        return deleteDeepField(current, fieldPath);
    });
}

/**
 * Sets a value in a deeply nested map
 *
 * @param map The map to update
 * @param path The key path as an array
 * @param value The value to set
 */
function setDeep<K extends any[], V>(
    map: DeepMap<K, V>,
    path: K,
    value: V,
): void {
    if (path.length === 1) {
        (map as Map<any, V>).set(path[0], value);
        return;
    }

    const [head, ...tail] = path;
    let nextMap = (map as Map<any, any>).get(head);

    if (!nextMap) {
        nextMap = new Map();
        (map as Map<any, any>).set(head, nextMap);
    }

    setDeep(nextMap, tail as any, value);
}

/**
 * Gets a value from a deeply nested map
 *
 * @param map The map to query
 * @param path The key path as an array
 * @returns The value or undefined if not found
 */
function getDeep<K extends any[], V>(
    map: DeepMap<K, V>,
    path: K,
): V | undefined {
    if (path.length === 1) {
        return (map as Map<any, V>).get(path[0]);
    }

    const [head, ...tail] = path;
    const nextMap = (map as Map<any, any>).get(head);

    if (!nextMap) {
        return undefined;
    }

    return getDeep(nextMap, tail as any);
}

// Export all functions and types
export {
    // Types
    NestedMap,
    MapDiffResult,
    DeepMap,

    // Basic nested map operations
    createNestedMap,
    setNested,
    getNested,
    deleteNested,
    updateNested,
    flattenEntries,
    fromFlatEntries,

    // Map transformations
    mergeNestedMaps,
    mapValues,
    filterNested,

    // Map join operations
    mapUnion,
    mapJoinWithHandler,
    mapIntersection,
    mapZipJoin,
    mapLeftJoin,
    mapDiffJoin,
    mapJoinOneLiner,

    // Object operations
    updateObjectField,
    deleteObjectField,
    patchObject,

    // Deep object operations
    updateDeepField,
    deleteDeepField,
    updateNestedObjectField,
    deleteNestedObjectField,

    // Deep map operations
    setDeep,
    getDeep,
};
